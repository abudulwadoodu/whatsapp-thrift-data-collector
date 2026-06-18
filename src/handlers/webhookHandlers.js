const { getMediaUrl, sendWhatsAppTextMessage } = require('../services/whatsappService');
const { downloadWhatsAppMedia } = require('../utils/downloadMedia');
const { uploadToDrive } = require('../services/driveService');
const { findEventByMessageId, insertEventRow, updateEventRowByNumber } = require('../services/sheetsService');
const { analyzeImageAndGetTitle } = require('../services/visionService');
const { createLogger } = require('../utils/logger');
const { withRetry } = require('../utils/retry');
const { checkAndConsumePhoneQuota } = require('../utils/rateLimiter');

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

function formatSheetTimestamp(date = new Date()) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const sec = String(date.getSeconds()).padStart(2, '0');
    return `${month}/${day}/${year} ${h}:${min}:${sec}`;
}

function verifyWebhook({ mode, token, challenge, log = console }) {
    const logger = log.info ? log : createLogger(log);
    if (!mode || !token) {
        logger.warn('Webhook verify: missing hub.mode or hub.verify_token', { mode: !!mode, token: !!token });
        return { status: 403, body: '' };
    }

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        logger.info('WEBHOOK_VERIFIED');
        return { status: 200, body: challenge };
    }

    logger.warn('Webhook verify: token or mode mismatch', { mode, tokenMatch: token === VERIFY_TOKEN });
    return { status: 403, body: '' };
}

async function processWebhookEvent(body, log = console) {
    const logger = log.info ? log : createLogger(log);
    if (!body || body.object !== 'whatsapp_business_account') {
        logger.warn('received', { message: 'Ignoring webhook with unsupported object', object: body?.object });
        return { status: 200 };
    }

    const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const contact = body?.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];

    if (!message || !contact) {
        logger.warn('received', { message: 'Malformed payload or no message/contact' });
        return { status: 200 };
    }

    const messageId = message.id;
    const phone = contact.wa_id;
    logger.info('received', { message_id: messageId, phone_number: phone });

    if (message.type !== 'image') {
        logger.info('validated', { message_id: messageId, phone_number: phone, result: 'ignored_non_image', type: message.type });
        return { status: 200 };
    }

    if (!messageId || !message.image?.id) {
        logger.warn('validated', { message_id: messageId, phone_number: phone, result: 'invalid_image_payload' });
        return { status: 200 };
    }

    const quota = checkAndConsumePhoneQuota(phone);
    if (!quota.allowed) {
        logger.warn('validated', {
            message_id: messageId,
            phone_number: phone,
            result: 'rate_limited',
            daily_limit: quota.limit,
        });
        await sendWhatsAppTextMessage(phone, `Daily limit reached (${quota.limit}). Please try again tomorrow.`, logger);
        return { status: 200 };
    }

    const existing = await withRetry(
        () => findEventByMessageId(messageId, logger),
        { label: 'sheet_dedupe_lookup', log: logger, attempts: 3, delayMs: 400, meta: { message_id: messageId, phone_number: phone } }
    );
    if (existing) {
        logger.info('validated', { message_id: messageId, phone_number: phone, result: 'duplicate_skipped' });
        return { status: 200 };
    }

    const timestamp = formatSheetTimestamp();
    const caption = message.image.caption || '';
    const pendingRow = await withRetry(
        () => insertEventRow({
            message_id: messageId,
            phone_number: phone,
            image_url: '',
            description: caption,
            timestamp,
            status: 'pending',
        }, logger),
        { label: 'sheet_insert_pending', log: logger, attempts: 3, delayMs: 400, meta: { message_id: messageId, phone_number: phone } }
    );
    logger.info('validated', { message_id: messageId, phone_number: phone, status: 'pending', row: pendingRow.rowNumber });

    setImmediate(async () => {
        try {
            const mediaId = message.image.id;
            const mediaUrl = await withRetry(
                () => getMediaUrl(mediaId, logger),
                { label: 'whatsapp_get_media_url', log: logger, attempts: 3, delayMs: 500, meta: { message_id: messageId, phone_number: phone } }
            );

            const buffer = await withRetry(
                () => downloadWhatsAppMedia(mediaUrl, WHATSAPP_TOKEN, logger),
                { label: 'whatsapp_download_media', log: logger, attempts: 3, delayMs: 500, meta: { message_id: messageId, phone_number: phone } }
            );
            logger.info('download', { message_id: messageId, phone_number: phone, bytes: buffer.length });

            const visionResult = await withRetry(
                () => analyzeImageAndGetTitle(buffer),
                { label: 'vision_analysis', log: logger, attempts: 3, delayMs: 500, meta: { message_id: messageId, phone_number: phone } }
            );
            logger.info('vision', { message_id: messageId, phone_number: phone, title: visionResult.title });

            const safePhone = String(phone).replace(/\D/g, '');
            const fileName = `item_${Date.now()}_${safePhone}.jpg`;
            const driveFile = await withRetry(
                () => uploadToDrive(buffer, fileName, 'image/jpeg', logger),
                { label: 'drive_upload', log: logger, attempts: 3, delayMs: 500, meta: { message_id: messageId, phone_number: phone } }
            );
            logger.info('upload', { message_id: messageId, phone_number: phone, file_name: fileName });

            await withRetry(
                () => updateEventRowByNumber(pendingRow.rowNumber, {
                    message_id: messageId,
                    phone_number: phone,
                    image_url: driveFile.webViewLink || '',
                    description: caption || visionResult.title || '',
                    timestamp,
                    status: 'processed',
                }, logger),
                { label: 'sheet_update_processed', log: logger, attempts: 3, delayMs: 500, meta: { message_id: messageId, phone_number: phone } }
            );
            logger.info('sheet_update', { message_id: messageId, phone_number: phone, status: 'processed' });

            await sendWhatsAppTextMessage(phone, 'Item received successfully', logger);
            logger.info('completed', { message_id: messageId, phone_number: phone, status: 'processed' });
        } catch (error) {
            logger.error('processing_failed', { message_id: messageId, phone_number: phone, message: error.message });
            try {
                await withRetry(
                    () => updateEventRowByNumber(pendingRow.rowNumber, {
                        message_id: messageId,
                        phone_number: phone,
                        image_url: '',
                        description: caption,
                        timestamp,
                        status: 'failed',
                    }, logger),
                    { label: 'sheet_update_failed', log: logger, attempts: 3, delayMs: 500, meta: { message_id: messageId, phone_number: phone } }
                );
            } catch (sheetError) {
                logger.error('failed_status_update_error', {
                    message_id: messageId,
                    phone_number: phone,
                    message: sheetError.message,
                });
            }

            try {
                await sendWhatsAppTextMessage(phone, 'Failed to process, please try again', logger);
            } catch (ackError) {
                logger.error('failure_ack_send_error', {
                    message_id: messageId,
                    phone_number: phone,
                    message: ackError.message,
                });
            }
        }
    });

    return { status: 200 };
}

module.exports = {
    verifyWebhook,
    processWebhookEvent,
};
