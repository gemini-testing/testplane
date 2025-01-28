"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldIgnoreUnhandledRejection = void 0;
const puppeteerErrMsgs = [/Cannot extract value when objectId is given/, /Execution context was destroyed/];
const shouldIgnoreUnhandledRejection = (err) => {
    if (!err) {
        return false;
    }
    if (err.name === "ProtocolError" || err.name === "TargetCloseError") {
        return true;
    }
    if (puppeteerErrMsgs.some(msg => msg.test(err.message)) && err.stack?.includes("/puppeteer-core/")) {
        return true;
    }
    return false;
};
exports.shouldIgnoreUnhandledRejection = shouldIgnoreUnhandledRejection;
//# sourceMappingURL=errors.js.map