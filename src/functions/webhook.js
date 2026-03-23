const { app } = require('@azure/functions');
const { verifyWebhook, processWebhookEvent } = require('../handlers/webhookHandlers');
const { createLogger } = require('../utils/logger');

app.http('webhook-verify', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'webhook',
    handler: async (request, context) => {
        const logger = createLogger(context);
        try {
            const result = verifyWebhook({
                mode: request.query.get('hub.mode'),
                token: request.query.get('hub.verify_token'),
                challenge: request.query.get('hub.challenge'),
                log: logger,
            });
            return { status: result.status, body: result.body };
        } catch (error) {
            logger.error('Error verifying webhook', { message: error.message });
            return { status: 500 };
        }
    },
});

app.http('webhook-events', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'webhook',
    handler: async (request, context) => {
        const logger = createLogger(context);
        try {
            const body = await request.json();
            const result = await processWebhookEvent(body, logger);
            return { status: result.status };
        } catch (error) {
            logger.error('Error handling webhook', { message: error.message });
            return { status: 500 };
        }
    },
});
