const LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

function resolveLogLevel() {
    const value = (process.env.LOG_LEVEL || 'info').toLowerCase();
    return LEVELS[value] !== undefined ? value : 'info';
}

function isDebugEnabled() {
    return process.env.WHATSAPP_DEBUG === 'true' || resolveLogLevel() === 'debug';
}

function shouldLog(level) {
    return LEVELS[level] <= LEVELS[resolveLogLevel()];
}

function sanitizeValue(value, depth = 0) {
    if (value === null || value === undefined) {
        return value;
    }

    if (depth > 3) {
        return '[Truncated]';
    }

    if (typeof value === 'string') {
        if (
            /bearer\s+[a-z0-9._-]+/i.test(value) ||
            /token/i.test(value) ||
            value.length > 120
        ) {
            return '[REDACTED]';
        }
        return value;
    }

    if (Array.isArray(value)) {
        return value.map((item) => sanitizeValue(item, depth + 1));
    }

    if (typeof value === 'object') {
        const output = {};
        for (const [key, val] of Object.entries(value)) {
            if (/token|authorization|secret|password|refresh/i.test(key)) {
                output[key] = '[REDACTED]';
            } else {
                output[key] = sanitizeValue(val, depth + 1);
            }
        }
        return output;
    }

    return value;
}

function emit(target, fallback, method, message, meta) {
    const metaText = meta ? ` ${JSON.stringify(sanitizeValue(meta))}` : '';
    if (target && typeof target[method] === 'function') {
        target[method](`${message}${metaText}`);
        return;
    }
    fallback[method](`${message}${metaText}`);
}

function createLogger(target) {
    const sink = target || console;
    const fallback = console;

    return {
        error(message, meta) {
            if (shouldLog('error')) emit(sink, fallback, 'error', message, meta);
        },
        warn(message, meta) {
            if (shouldLog('warn')) emit(sink, fallback, 'warn', message, meta);
        },
        info(message, meta) {
            if (shouldLog('info')) emit(sink, fallback, 'log', message, meta);
        },
        debug(message, meta) {
            if (isDebugEnabled()) emit(sink, fallback, 'log', message, meta);
        },
    };
}

module.exports = {
    createLogger,
    isDebugEnabled,
};
