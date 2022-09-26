"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class CoreError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CoreError';
    }
}
exports.default = CoreError;
;
