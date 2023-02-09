'use strict';

const logger = require('../utils/logger');

process.on('unhandledRejection', (reason, p) => {
    logger.error(`Unhandled Rejection in hermione:worker:${process.pid}:\nPromise: `, p, '\nReason: ', reason);
});

module.exports = async (module, methodName, args, cb) => {
    try {
        const result = await require(module)[methodName](...args);
        cb(null, result);
    } catch (e) {
        cb(e);
    }
};
