const fs = require('fs');
const axios = require('axios');
const path = require('path');

/**
 * Downloads media from WhatsApp Graph API and returns a buffer.
 * @param {string} url - WhatsApp media URL
 * @param {string} token - WhatsApp Access Token
 * @returns {Promise<Buffer>}
 */
async function downloadWhatsAppMedia(url, token) {
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'arraybuffer',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error('Error downloading media:', error.response ? error.response.data : error.message);
    throw new Error('Failed to download media from WhatsApp');
  }
}

module.exports = { downloadWhatsAppMedia };
