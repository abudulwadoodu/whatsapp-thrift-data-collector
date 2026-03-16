/**
 * One-time Google OAuth flow for personal Gmail.
 * Run: node scripts/auth-google.js
 *
 * 1. Add http://localhost:3001/auth/callback to your OAuth client's
 *    "Authorized redirect URIs" in Google Cloud Console.
 * 2. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env
 * 3. Run this script; sign in with your Gmail in the browser
 * 4. Add the printed GOOGLE_REFRESH_TOKEN to your .env
 */

const path = require('path');
const http = require('http');
const { google } = require('googleapis');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const REDIRECT_URI = 'http://localhost:3001/auth/callback';
const SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/cloud-vision'
];

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
    console.error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env');
    console.error('Create OAuth 2.0 credentials at: https://console.cloud.google.com/apis/credentials');
    process.exit(1);
}

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
});

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '', `http://localhost:3001`);
    if (url.pathname !== '/auth/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
    }
    const code = url.searchParams.get('code');
    if (!code) {
        res.writeHead(400);
        res.end('Missing code. Try again.');
        return;
    }
    try {
        const { tokens } = await oauth2.getToken(code);
        oauth2.setCredentials(tokens);
        const refreshToken = tokens.refresh_token;
        if (!refreshToken) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
                <h1>No refresh token</h1>
                <p>You may have already authorized. Revoke access at
                <a href="https://myaccount.google.com/permissions">Google Account permissions</a>
                and run this script again, or use the access_token (short-lived) shown in the terminal.</p>
            `);
            server.close();
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <h1>Success</h1>
            <p>Add this to your <code>.env</code> file:</p>
            <pre>GOOGLE_REFRESH_TOKEN=${refreshToken}</pre>
            <p>You can close this tab and stop the script (Ctrl+C).</p>
        `);
        console.log('\nAdd this line to your .env file:\n');
        console.log('GOOGLE_REFRESH_TOKEN=' + refreshToken);
        console.log('');
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error: ' + err.message);
        console.error(err);
    }
    server.close();
});

server.listen(3001, () => {
    console.log('Open this URL in your browser (sign in with your Gmail):');
    console.log(authUrl);
    console.log('\nWaiting for callback on http://localhost:3001/auth/callback ...');
});
