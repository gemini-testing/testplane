'use strict';

exports.logger = {
    log: console.log,
    warn: console.warn,
    error: console.error
};

exports.require = (path) => require(path);
