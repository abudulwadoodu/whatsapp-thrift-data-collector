const crypto = require('crypto');
const { getMediaUrl } = require('../services/whatsappService');
const { downloadWhatsAppMedia } = require('../utils/downloadMedia');
const { uploadToDrive } = require('../services/driveService');
const { appendToSheet } = require('../services/sheetsService');
const { analyzeImageAndGetTitle } = require('../services/visionService');
const { createLogger } = require('../utils/logger');

const IMAGE_PATH_PREFIX = process.env.GOOGLE_DRIVE_IMAGE_PATH_PREFIX || 'Thrifting_Images';
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

function generateOrderId() {
    return crypto.randomBytes(4).toString('hex');
}

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
    if (body.object !== 'whatsapp_business_account') {
        logger.warn('Ignoring webhook with unsupported object', { object: body.object });
        return { status: 404 };
    }

    const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const contact = body?.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];

    if (!message || !contact) {
        logger.info('Webhook payload has no message/contact. Nothing to process.');
        return { status: 200 };
    }

    const phone = contact.wa_id;

    if (message.type !== 'image') {
        logger.info('Ignoring unsupported message type', { type: message.type, phone });
        return { status: 200 };
    }

    logger.info('Processing image message', { phone });

    const mediaId = message.image.id;
    const caption = message.image.caption || 'No caption';

    const mediaUrl = await getMediaUrl(mediaId, logger);
    logger.debug('Resolved media URL for image', { mediaId });
    const buffer = await downloadWhatsAppMedia(mediaUrl, WHATSAPP_TOKEN, logger);
    logger.debug('Downloaded media buffer', { bytes: buffer.length });
    const { title, labelsText } = await analyzeImageAndGetTitle(buffer);
    logger.debug('Vision analysis complete', { title, labelsCount: labelsText ? labelsText.split(',').length : 0 });

    const orderId = generateOrderId();
    const orderNo = `ITEM-${orderId}`;
    const fileName = `${orderNo}.${Date.now()}.jpg`;

    await uploadToDrive(buffer, fileName, 'image/jpeg', logger);

    const productImagePath = `${IMAGE_PATH_PREFIX}/${fileName}`;
    const timestamp = formatSheetTimestamp();
    await appendToSheet([
        orderNo,
        productImagePath,
        title,
        caption || '',
        '',
        '0.000000, 0.000000',
        labelsText,
        '',
        phone,
        timestamp
    ], logger);

    logger.info('Successfully processed image', { phone, orderNo, title });
    return { status: 200 };
}

module.exports = {
    verifyWebhook,
    processWebhookEvent,
};
