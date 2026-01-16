const BaseInformer = require("./base");
const logger = require("../../utils/logger");

module.exports = class ConsoleInformer extends BaseInformer {
    log(...args) {
        logger.log(...args);
    }

    warn(...args) {
        logger.warn(...args);
    }

    error(...args) {
        logger.error(...args);
    }

    end(message) {
        if (message) {
            logger.log(message);
        }
    }
};
