'use strict';

require('log-prefix')(() => `[${new Date().toLocaleString()}] %s`);

module.exports = {
    log: console.log,
    warn: console.warn,
    error: console.error
};
