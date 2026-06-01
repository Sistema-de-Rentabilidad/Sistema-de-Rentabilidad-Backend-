const { NODE_ENV } = require('../config/env');

const formatMeta = (meta) => {
    if (!meta) return '';
    try {
        return ` | ${typeof meta === 'string' ? meta : JSON.stringify(meta)}`;
    } catch {
        return ` | ${String(meta)}`;
    }
};

const info = (message, meta) => {
    if (NODE_ENV === 'test') return;
    console.info(`INFO: ${message}${formatMeta(meta)}`);
};

const warn = (message, meta) => {
    if (NODE_ENV === 'test') return;
    console.warn(`WARN: ${message}${formatMeta(meta)}`);
};

const error = (message, meta) => {
    if (NODE_ENV === 'test') return;
    console.error(`ERROR: ${message}${formatMeta(meta)}`);
};

module.exports = {
    info,
    warn,
    error,
};
