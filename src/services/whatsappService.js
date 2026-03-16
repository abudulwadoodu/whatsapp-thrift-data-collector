const axios = require('axios');
require('dotenv').config();

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

/**
 * Gets the media URL from WhatsApp Graph API using the media ID.
 * @param {string} mediaId 
 * @returns {Promise<string>} - Media URL
 */
async function getMediaUrl(mediaId) {
    try {
        const response = await axios({
            method: 'GET',
            url: `https://graph.facebook.com/v18.0/${mediaId}`,
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`
            }
        });
        return response.data.url;
    } catch (error) {
        console.error('Error getting media URL:', error.response ? error.response.data : error.message);
        throw new Error('Failed to retrieve media URL from WhatsApp API');
    }
}

module.exports = { getMediaUrl };
