"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreError = void 0;
/**
 * @category Errors
 */
class CoreError extends Error {
    constructor(message) {
        super(message);
        this.name = "CoreError";
    }
}
exports.CoreError = CoreError;
//# sourceMappingURL=core-error.js.map