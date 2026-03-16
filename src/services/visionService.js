const { google } = require('googleapis');
const { getAuthenticatedClient } = require('../config/googleOAuth');

let vision = null;

async function getVision() {
    if (vision) return vision;
    const auth = await getAuthenticatedClient();
    vision = google.vision({ version: 'v1', auth });
    return vision;
}

/** Keyword groups for title generation (same as Apps Script) */
const COLOR_WORDS = ['red', 'blue', 'green', 'yellow', 'white', 'black', 'brown', 'grey', 'gray', 'orange'];
const MATERIAL_WORDS = ['wood', 'wooden', 'metal', 'iron', 'steel', 'plastic', 'cloth', 'leather', 'fabric'];
const OBJECT_WORDS = ['chair', 'table', 'sofa', 'couch', 'bed', 'toy', 'shirt', 'tshirt', 'book', 'phone', 'laptop', 'bottle', 'bag', 'fan', 'lamp', 'cupboard'];

/**
 * Get label annotations from Google Vision API (LABEL_DETECTION).
 * @param {Buffer} imageBuffer - Raw image bytes
 * @returns {Promise<string[]>} - Array of label strings (lowercase)
 */
async function getLabelsFromImage(imageBuffer) {
    const client = await getVision();
    const base64 = imageBuffer.toString('base64');

    const res = await client.images.annotate({
        requestBody: {
            requests: [{
                image: { content: base64 },
                features: [{ type: 'LABEL_DETECTION', maxResults: 10 }]
            }]
        }
    });

    const response = res.data.responses?.[0];
    if (!response?.labelAnnotations || response.labelAnnotations.length === 0) {
        return [];
    }
    return response.labelAnnotations.map((l) => (l.description || '').toLowerCase()).filter(Boolean);
}

/**
 * Generate a product title from Vision labels (same logic as Apps Script).
 * @param {string[]} labels - Lowercase label strings
 * @returns {string} - Title with first letters capitalized
 */
function titleFromLabels(labels) {
    const capitalize = (str) => (str ? str.charAt(0).toUpperCase() + str.slice(1) : '');
    const color = labels.find((l) => COLOR_WORDS.includes(l));
    const material = labels.find((l) => MATERIAL_WORDS.includes(l));
    const object = labels.find((l) => OBJECT_WORDS.includes(l));

    let title = [capitalize(color), capitalize(material), capitalize(object)].filter(Boolean).join(' ');
    if (!title) title = capitalize(labels[0] || 'Unknown Item');
    return title;
}

/**
 * Analyze image buffer: get labels and generated title.
 * @param {Buffer} imageBuffer - Raw image bytes
 * @returns {Promise<{ labels: string[], labelsText: string, title: string }>}
 */
async function analyzeImageAndGetTitle(imageBuffer) {
    const labels = await getLabelsFromImage(imageBuffer);
    const labelsText = labels.join(', ');
    const title = titleFromLabels(labels);
    return { labels, labelsText, title };
}

module.exports = { getLabelsFromImage, titleFromLabels, analyzeImageAndGetTitle };
