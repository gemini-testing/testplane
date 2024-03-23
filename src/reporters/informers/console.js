import BaseInformer from "./base.js";
import logger from "../../utils/logger.js";

export default class ConsoleInformer extends BaseInformer {
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
}
