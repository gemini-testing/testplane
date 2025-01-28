"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestplaneInternalError = void 0;
/**
 * @category Errors
 */
class TestplaneInternalError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}
exports.TestplaneInternalError = TestplaneInternalError;
//# sourceMappingURL=testplane-internal-error.js.map