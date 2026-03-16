const { google } = require('googleapis');
const { getAuthenticatedClient } = require('../config/googleOAuth');

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

if (!GOOGLE_SHEET_ID) {
    throw new Error('Missing GOOGLE_SHEET_ID in .env');
}

let sheets = null;

async function getSheets() {
    if (sheets) return sheets;
    const auth = await getAuthenticatedClient();
    sheets = google.sheets({ version: 'v4', auth });
    return sheets;
}

const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || 'Sheet1';

/**
 * Appends a row to the ThriftItems sheet.
 * Column A (Sl #) is never written to – only B:K are updated so A2's formula can auto-fill Sl #.
 * B=Order #, C=Product Image path, D=Title, E=Description, F=Price, G=Location,
 * H=Category, I=Contact Name, J=Contact #, K=Timestamp
 * @param {Array} values - Row data [orderNo, productImagePath, title, description, price, location, category, contactName, contactNo, timestamp]
 */
async function appendToSheet(values) {
    try {
        const client = await getSheets();
        const rangeColB = `${SHEET_NAME}!B:B`;
        const { data } = await client.spreadsheets.values.get({
            spreadsheetId: GOOGLE_SHEET_ID,
            range: rangeColB,
            majorDimension: 'COLUMNS'
        });
        const rows = (data.values && data.values[0]) ? data.values[0] : [];
        const nextRow = rows.length + 1;
        const updateRange = `${SHEET_NAME}!B${nextRow}:K${nextRow}`;

        const response = await client.spreadsheets.values.update({
            spreadsheetId: GOOGLE_SHEET_ID,
            range: updateRange,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [values]
            }
        });
        console.log(`Row appended to Sheets (row ${nextRow}, B:K only): ${response.data.updatedCells ?? 'OK'}`);
        return response.data;
    } catch (error) {
        console.error('Error appending to Sheets:', error.message);
        throw new Error('Failed to log data to Google Sheets');
    }
}

module.exports = { appendToSheet };
