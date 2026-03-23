const axios = require('axios');
const { createLogger, isDebugEnabled } = require('./logger');

/**
 * Downloads media from WhatsApp Graph API and returns a buffer.
 * @param {string} url - WhatsApp media URL
 * @param {string} token - WhatsApp Access Token
 * @returns {Promise<Buffer>}
 */
async function downloadWhatsAppMedia(url, token, log) {
  const logger = log && log.info ? log : createLogger(log);
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
    const apiError = error.response?.data?.error;
    logger.error('Error downloading WhatsApp media', {
      message: apiError?.message || error.message,
      status: error.response?.status
    });
    if (isDebugEnabled()) {
      logger.debug('WhatsApp media download debug details', {
        urlHost: (() => {
          try {
            return new URL(url).host;
          } catch (e) {
            return 'invalid-url';
          }
        })(),
        type: apiError?.type,
        code: apiError?.code,
        error_subcode: apiError?.error_subcode,
        fbtrace_id: apiError?.fbtrace_id
      });
    }
    throw new Error('Failed to download media from WhatsApp');
  }
}

module.exports = { downloadWhatsAppMedia };
