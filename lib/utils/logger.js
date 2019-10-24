'use strict';

require('log-prefix')(() => {
    const date = new Date().toLocaleString('ru', {timeZone: 'Europe/Moscow', timeZoneName: 'short'});

    return `[${date}] %s`;
});

module.exports = {
    log: console.log,
    warn: console.warn,
    error: console.error
};
