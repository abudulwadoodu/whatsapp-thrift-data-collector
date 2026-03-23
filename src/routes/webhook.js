const express = require('express');
const router = express.Router();
const { verifyWebhook, processWebhookEvent } = require('../handlers/webhookHandlers');
require('dotenv').config();

/**
 * Webhook Verification (GET)
 * Required by WhatsApp/Meta to verify the endpoint.
 */
router.get('/', (req, res) => {
    const result = verifyWebhook({
        mode: req.query['hub.mode'],
        token: req.query['hub.verify_token'],
        challenge: req.query['hub.challenge']
    });
    res.status(result.status).send(result.body);
});

/**
 * Handle Webhook Events (POST)
 */
router.post('/', async (req, res) => {
    try {
        const result = await processWebhookEvent(req.body);
        res.sendStatus(result.status);
    } catch (error) {
        console.error('Error handling webhook:', error.message);
        res.sendStatus(500);
    }
});

module.exports = router;
