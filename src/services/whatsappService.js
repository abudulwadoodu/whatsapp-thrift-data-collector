const axios = require('axios');
require('dotenv').config();
const { createLogger, isDebugEnabled } = require('../utils/logger');

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WHATSAPP_GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v18.0';

/**
 * Gets the media URL from WhatsApp Graph API using the media ID.
 * @param {string} mediaId 
 * @returns {Promise<string>} - Media URL
 */
async function getMediaUrl(mediaId, log) {
    const logger = log && log.info ? log : createLogger(log);
    try {
        const response = await axios({
            method: 'GET',
            url: `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${mediaId}`,
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`
            }
        });
        return response.data.url;
    } catch (error) {
        const apiError = error.response?.data?.error;
        logger.error('Error getting media URL from WhatsApp API', {
            message: apiError?.message || error.message,
            status: error.response?.status
        });
        if (isDebugEnabled()) {
            logger.debug('WhatsApp media URL debug details', {
                graphVersion: WHATSAPP_GRAPH_VERSION,
                mediaId,
                type: apiError?.type,
                code: apiError?.code,
                error_subcode: apiError?.error_subcode,
                fbtrace_id: apiError?.fbtrace_id
            });
        }
        throw new Error('Failed to retrieve media URL from WhatsApp API');
    }
}

async function sendWhatsAppTextMessage(to, text, log) {
    const logger = log && log.info ? log : createLogger(log);
    try {
        await axios({
            method: 'POST',
            url: `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`,
            headers: {
                Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json',
            },
            data: {
                messaging_product: 'whatsapp',
                to,
                type: 'text',
                text: { body: text },
            },
        });
        logger.info('WhatsApp acknowledgement sent', { phone_number: to });
    } catch (error) {
        const apiError = error.response?.data?.error;
        logger.error('Failed to send WhatsApp acknowledgement', {
            phone_number: to,
            message: apiError?.message || error.message,
            status: error.response?.status,
        });
        if (isDebugEnabled()) {
            logger.debug('WhatsApp acknowledgement debug details', {
                type: apiError?.type,
                code: apiError?.code,
                error_subcode: apiError?.error_subcode,
                fbtrace_id: apiError?.fbtrace_id,
            });
        }
        throw new Error('Failed to send WhatsApp acknowledgement');
    }
}

module.exports = { getMediaUrl, sendWhatsAppTextMessage };
