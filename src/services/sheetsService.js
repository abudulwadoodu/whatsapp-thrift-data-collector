const { google } = require('googleapis');
const { getAuthenticatedClient } = require('../config/googleOAuth');
const { createLogger } = require('../utils/logger');

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const EVENTS_SHEET_NAME = process.env.GOOGLE_EVENTS_SHEET_NAME || 'WebhookEvents';

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
const EVENTS_HEADERS = ['message_id', 'phone_number', 'image_url', 'description', 'timestamp', 'status'];

let eventsSheetEnsured = false;

function parseRowNumberFromRange(range) {
    const match = range && range.match(/![A-Z]+(\d+):[A-Z]+(\d+)/);
    return match ? Number(match[1]) : null;
}

async function ensureEventsSheet(log) {
    if (eventsSheetEnsured) return;
    const logger = log && log.info ? log : createLogger(log);
    const client = await getSheets();
    const spreadsheet = await client.spreadsheets.get({
        spreadsheetId: GOOGLE_SHEET_ID,
        fields: 'sheets.properties.title',
    });

    const existing = spreadsheet.data.sheets?.some(
        (sheet) => sheet.properties?.title === EVENTS_SHEET_NAME
    );

    if (!existing) {
        await client.spreadsheets.batchUpdate({
            spreadsheetId: GOOGLE_SHEET_ID,
            requestBody: {
                requests: [{
                    addSheet: {
                        properties: { title: EVENTS_SHEET_NAME },
                    },
                }],
            },
        });
        logger.info('Created events sheet tab', { sheet: EVENTS_SHEET_NAME });
    }

    const headerRange = `${EVENTS_SHEET_NAME}!A1:F1`;
    const headerResponse = await client.spreadsheets.values.get({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: headerRange,
    });

    const currentHeaders = headerResponse.data.values?.[0] || [];
    const needsHeader = EVENTS_HEADERS.some((header, idx) => currentHeaders[idx] !== header);
    if (needsHeader) {
        await client.spreadsheets.values.update({
            spreadsheetId: GOOGLE_SHEET_ID,
            range: headerRange,
            valueInputOption: 'RAW',
            requestBody: { values: [EVENTS_HEADERS] },
        });
        logger.info('Initialized events sheet headers', { sheet: EVENTS_SHEET_NAME });
    }

    eventsSheetEnsured = true;
}

async function findEventByMessageId(messageId, log) {
    const logger = log && log.info ? log : createLogger(log);
    await ensureEventsSheet(logger);
    const client = await getSheets();
    const response = await client.spreadsheets.values.get({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: `${EVENTS_SHEET_NAME}!A2:F`,
    });
    const rows = response.data.values || [];
    for (let i = 0; i < rows.length; i += 1) {
        if (rows[i][0] === messageId) {
            const rowNumber = i + 2;
            return {
                rowNumber,
                row: {
                    message_id: rows[i][0] || '',
                    phone_number: rows[i][1] || '',
                    image_url: rows[i][2] || '',
                    description: rows[i][3] || '',
                    timestamp: rows[i][4] || '',
                    status: rows[i][5] || '',
                },
            };
        }
    }
    return null;
}

async function insertEventRow(entry, log) {
    const logger = log && log.info ? log : createLogger(log);
    await ensureEventsSheet(logger);
    const client = await getSheets();
    const response = await client.spreadsheets.values.append({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: `${EVENTS_SHEET_NAME}!A:F`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [[
                entry.message_id,
                entry.phone_number,
                entry.image_url || '',
                entry.description || '',
                entry.timestamp || '',
                entry.status || 'pending',
            ]],
        },
    });
    const updatedRange = response.data.updates?.updatedRange;
    const rowNumber = parseRowNumberFromRange(updatedRange);
    return { rowNumber };
}

async function updateEventRowByNumber(rowNumber, entry, log) {
    const logger = log && log.info ? log : createLogger(log);
    await ensureEventsSheet(logger);
    const client = await getSheets();
    await client.spreadsheets.values.update({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: `${EVENTS_SHEET_NAME}!A${rowNumber}:F${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [[
                entry.message_id,
                entry.phone_number,
                entry.image_url || '',
                entry.description || '',
                entry.timestamp || '',
                entry.status,
            ]],
        },
    });
}

/**
 * Appends a row to the ThriftItems sheet.
 * Column A (Sl #) is never written to – only B:K are updated so A2's formula can auto-fill Sl #.
 * B=Order #, C=Product Image path, D=Title, E=Description, F=Price, G=Location,
 * H=Category, I=Contact Name, J=Contact #, K=Timestamp
 * @param {Array} values - Row data [orderNo, productImagePath, title, description, price, location, category, contactName, contactNo, timestamp]
 */
async function appendToSheet(values, log) {
    const logger = log && log.info ? log : createLogger(log);
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
        logger.info('Row appended to Sheets', {
            row: nextRow,
            updatedCells: response.data.updatedCells ?? 'OK'
        });
        return response.data;
    } catch (error) {
        logger.error('Error appending to Sheets', { message: error.message, status: error.response?.status });
        throw new Error('Failed to log data to Google Sheets');
    }
}

module.exports = {
    appendToSheet,
    findEventByMessageId,
    insertEventRow,
    updateEventRowByNumber,
};
