"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class CancelledError extends Error {
    constructor() {
        super();
        this.name = 'CancelledError';
        this.message = 'Browser request was cancelled';
        Error.captureStackTrace(this, CancelledError);
    }
}
exports.default = CancelledError;
;
