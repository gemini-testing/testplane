"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CancelledError = void 0;
/**
 * @category Errors
 */
class CancelledError extends Error {
    constructor() {
        super();
        this.name = "CancelledError";
        this.message = "Browser request was cancelled";
        Error.captureStackTrace(this, CancelledError);
    }
}
exports.CancelledError = CancelledError;
//# sourceMappingURL=cancelled-error.js.map