const { google } = require('googleapis');
require('dotenv').config();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

const SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/cloud-vision'
];

/**
 * Create OAuth2 client for use in scripts (auth flow).
 * Redirect URI must match the one in Google Cloud Console.
 */
function createOAuth2Client(redirectUri = 'http://localhost:3001/auth/callback') {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env');
    }
    return new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        redirectUri
    );
}

/**
 * Get authenticated client for API calls (Drive, Sheets, Vision).
 * Uses stored refresh token to obtain access token.
 */
async function getAuthenticatedClient() {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
        throw new Error(
            'Missing Google OAuth env. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN. ' +
            'Run: node scripts/auth-google.js to get a refresh token.'
        );
    }
    const oauth2 = createOAuth2Client();
    oauth2.setCredentials({
        refresh_token: GOOGLE_REFRESH_TOKEN
    });
    await oauth2.getAccessToken();
    return oauth2;
}

module.exports = {
    SCOPES,
    createOAuth2Client,
    getAuthenticatedClient
};
