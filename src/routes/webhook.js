const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { getMediaUrl } = require('../services/whatsappService');
const { downloadWhatsAppMedia } = require('../utils/downloadMedia');
const { uploadToDrive } = require('../services/driveService');
const { appendToSheet } = require('../services/sheetsService');
const { analyzeImageAndGetTitle } = require('../services/visionService');
require('dotenv').config();

const IMAGE_PATH_PREFIX = process.env.GOOGLE_DRIVE_IMAGE_PATH_PREFIX || 'Thrifting_Images';

function generateOrderId() {
    return crypto.randomBytes(4).toString('hex');
}

function formatSheetTimestamp(date = new Date()) {
    const d = date;
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const sec = String(d.getSeconds()).padStart(2, '0');
    return `${month}/${day}/${year} ${h}:${min}:${sec}`;
}

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

/**
 * Webhook Verification (GET)
 * Required by WhatsApp/Meta to verify the endpoint.
 */
router.get('/', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (!mode || !token) {
        console.warn('Webhook verify: missing hub.mode or hub.verify_token', { mode: !!mode, token: !!token });
        res.sendStatus(403);
        return;
    }

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('WEBHOOK_VERIFIED');
        res.status(200).send(challenge);
    } else {
        console.warn('Webhook verify: token or mode mismatch', { mode, tokenMatch: token === VERIFY_TOKEN });
        res.sendStatus(403);
    }
});

/**
 * Handle Webhook Events (POST)
 */
router.post('/', async (req, res) => {
    try {
        const { body } = req;

        if (body.object === 'whatsapp_business_account') {
            if (
                body.entry &&
                body.entry[0].changes &&
                body.entry[0].changes[0].value.messages &&
                body.entry[0].changes[0].value.messages[0]
            ) {
                const message = body.entry[0].changes[0].value.messages[0];
                const contact = body.entry[0].changes[0].value.contacts[0];
                const phone = contact.wa_id;

                // Check if message is an image
                if (message.type === 'image') {
                    console.log(`Processing image from ${phone}...`);

                    const mediaId = message.image.id;
                    const caption = message.image.caption || 'No caption';

                    // 1. Get media URL
                    const mediaUrl = await getMediaUrl(mediaId);

                    // 2. Download image
                    const buffer = await downloadWhatsAppMedia(mediaUrl, WHATSAPP_TOKEN);

                    // 3. Analyze image with Vision API (labels + product title)
                    const { title, labelsText } = await analyzeImageAndGetTitle(buffer);

                    // 4. Generate Order # and filename for sheet path
                    const orderId = generateOrderId();
                    const orderNo = `ITEM-${orderId}`;
                    const fileName = `${orderNo}.${Date.now()}.jpg`;

                    // 5. Upload to Google Drive
                    const driveFile = await uploadToDrive(buffer, fileName, 'image/jpeg');

                    // 6. Append row: Order #, Product Image path, Title, Description, Price, Location, Category, Contact Name, Contact #, Timestamp
                    const productImagePath = `${IMAGE_PATH_PREFIX}/${fileName}`;
                    const timestamp = formatSheetTimestamp();
                    await appendToSheet([
                        orderNo,
                        productImagePath,
                        title,
                        caption || '',
                        '',  // Price
                        '0.000000, 0.000000',  // Location
                        labelsText,
                        '',  // Contact Name
                        phone,
                        timestamp
                    ]);

                    console.log(`Successfully processed image from ${phone}: ${orderNo} - ${title}`);
                } else {
                    console.log(`Ignoring message type: ${message.type}`);
                }
            }
            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.error('Error handling webhook:', error.message);
        res.sendStatus(500);
    }
});

module.exports = router;
