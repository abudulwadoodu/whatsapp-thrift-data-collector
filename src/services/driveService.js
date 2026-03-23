const { google } = require('googleapis');
const stream = require('stream');
const { getAuthenticatedClient } = require('../config/googleOAuth');
const { createLogger } = require('../utils/logger');

const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

if (!GOOGLE_DRIVE_FOLDER_ID) {
    throw new Error('Missing GOOGLE_DRIVE_FOLDER_ID in .env');
}

let drive = null;

async function getDrive() {
    if (drive) return drive;
    const auth = await getAuthenticatedClient();
    drive = google.drive({ version: 'v3', auth });
    return drive;
}

/**
 * Uploads a buffer to Google Drive (your personal Drive when using OAuth).
 * @param {Buffer} buffer - File content
 * @param {string} fileName - Destination file name
 * @param {string} mimeType - File mime type
 * @returns {Promise<{ id: string, webViewLink: string }>}
 */
async function uploadToDrive(buffer, fileName, mimeType, log) {
    const logger = log && log.info ? log : createLogger(log);
    try {
        const driveClient = await getDrive();
        const bufferStream = new stream.PassThrough();
        bufferStream.end(buffer);

        const response = await driveClient.files.create({
            requestBody: {
                name: fileName,
                parents: [GOOGLE_DRIVE_FOLDER_ID],
                mimeType: mimeType
            },
            media: {
                mimeType: mimeType,
                body: bufferStream
            },
            fields: 'id, webViewLink'
        });

        logger.info('File uploaded to Drive', { fileId: response.data.id, fileName });
        return response.data;
    } catch (error) {
        logger.error('Error uploading to Drive', { message: error.message, status: error.response?.status });
        if (error.message?.includes('authentication') || error.response?.status === 401) {
            logger.warn('Drive authentication issue. Re-run node scripts/auth-google.js to refresh token.');
        }
        throw new Error('Failed to upload file to Google Drive');
    }
}

module.exports = { uploadToDrive };
