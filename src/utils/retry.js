const { createLogger } = require('./logger');

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(task, options = {}) {
    const {
        attempts = 3,
        delayMs = 500,
        label = 'operation',
        log,
        meta = {},
    } = options;

    const logger = log && log.info ? log : createLogger(log);
    let lastError;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            return await task(attempt);
        } catch (error) {
            lastError = error;
            logger.warn('Retryable operation failed', {
                label,
                attempt,
                attempts,
                message: error.message,
                ...meta,
            });
            if (attempt < attempts) {
                await sleep(delayMs * attempt);
            }
        }
    }

    throw lastError;
}

module.exports = { withRetry };
