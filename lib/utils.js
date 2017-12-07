'use strict';

const crypto = require('crypto');

exports.logger = {
    log: console.log,
    warn: console.warn,
    error: console.error
};

exports.getShortMD5 = (str) => crypto.createHash('md5').update(str, 'ascii').digest('hex').substr(0, 7);
