# WhatsApp to Google Drive & Sheets Webhook

A Node.js backend service that receives image messages from WhatsApp Business API, runs them through Google Cloud Vision (label detection), saves images to Google Drive, and logs metadata including an auto-generated product title and labels to a Google Sheet.

## Project Structure
```
/src
  server.js (Entry point)
  routes/
    webhook.js (Webhook GET/POST handlers)
  config/
    googleOAuth.js (Shared OAuth2 client for Drive, Sheets, Vision)
  services/
    whatsappService.js (Graph API calls)
    driveService.js (Google Drive API)
    sheetsService.js (Google Sheets API)
    visionService.js (Cloud Vision API – labels + product title)
  utils/
    downloadMedia.js (Media streaming)
  scripts/
    auth-google.js (One-time OAuth flow to get refresh token)
.env (Configuration)
```

## Prerequisites
- Node.js (v14+)
- A WhatsApp Business Account (via Meta for Developers)
- A Google Cloud Project with **OAuth 2.0 credentials** (Desktop or Web app) and **Cloud Vision API** enabled
- A Google Drive folder (in your own Drive) and its Folder ID
- A Google Sheet (you’ll use it with the same Gmail account)

## Installation
1. Clone the repository and run `npm install`.
2. Copy `.env.example` to `.env` and fill in WhatsApp and Google OAuth values (see below).

## Google OAuth (personal Gmail)
The app uses **OAuth** so uploads go to **your** Google Drive (no service account or quota issues).

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create **OAuth 2.0 Client ID** (Desktop app or Web application). If Web application, add **Authorized redirect URI**: `http://localhost:3001/auth/callback`.
2. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`.
3. Run once: **`node scripts/auth-google.js`**
   - A browser opens; sign in with the Gmail account you want to use for Drive/Sheets.
   - After authorizing, the script prints **`GOOGLE_REFRESH_TOKEN`**. Add that line to your `.env`.
4. Enable [Cloud Vision API](https://console.cloud.google.com/apis/library/vision.googleapis.com) for the same project.

## Environment Variables
- `WHATSAPP_TOKEN`, `PHONE_NUMBER_ID`, `VERIFY_TOKEN`: From Meta for Developers (WhatsApp).
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: From Google Cloud Console → APIs & credentials → OAuth 2.0.
- `GOOGLE_REFRESH_TOKEN`: Obtained by running `node scripts/auth-google.js` and adding the printed line to `.env`.
- `GOOGLE_DRIVE_FOLDER_ID`: The Drive folder ID where images will be saved (folder in your own Drive).
- `GOOGLE_SHEET_ID`: The Google Sheet ID.
- `GOOGLE_SHEET_NAME`: (Optional) Sheet tab name; default is `Sheet1`.

**Sheet layout:** Column A (Sl #) is for your formulas; the app appends **B:K**: Order #, Product Image path, Title, Description, Price, Location, Category, Contact Name, Contact #, Timestamp. Set `GOOGLE_SHEET_NAME` to your sheet tab (e.g. `ThriftItems`). Optional: `GOOGLE_DRIVE_IMAGE_PATH_PREFIX=Thrifting_Images` for the Product Image path.

## Running Locally with ngrok
1. Start the server: `node src/server.js` (runs on port 3000 by default).
2. Start ngrok: `ngrok http 3000`.
3. Copy the ngrok URL (e.g., `https://random-id.ngrok-free.app`).
4. In Meta for Developers, go to **WhatsApp > Configuration**:
   - **Callback URL**: `https://random-id.ngrok-free.app/webhook`
   - **Verify Token**: Your `VERIFY_TOKEN` value.
5. Subscribe to `messages` in the Webhook fields.

## Testing
1. Send an image to your WhatsApp Business Test Number.
2. Check the server console for logs.
3. Verify the image is in Google Drive.
4. Verify the new row in Google Sheets (timestamp, phone, caption, drive link, product title, labels).

**Note:** Enable the [Cloud Vision API](https://console.cloud.google.com/apis/library/vision.googleapis.com) for your Google Cloud project so label detection and title generation work.
