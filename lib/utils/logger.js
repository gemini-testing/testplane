'use strict';

require('log-prefix')(() => {
    const time = new Date().toString().split(' ').slice(4).join(' '); // e.g. "hh:mm:ss GMT+0300 (MSK)"

    return `[${time}] %s`;
});

module.exports = {
    log: console.log,
    warn: console.warn,
    error: console.error
};
