const BaseInformer = require('./base');
const logger = require('../../utils/logger');
module.exports = class ConsoleInformer extends BaseInformer {
    log(message) {
        logger.log(message);
    }
    warn(message) {
        logger.warn(message);
    }
    error(message) {
        logger.error(message);
    }
    end(message) {
        if (message) {
            logger.log(message);
        }
    }
};
