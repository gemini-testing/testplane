"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssertViewError = void 0;
/**
 * @category Errors
 */
class AssertViewError extends Error {
    constructor(message = "image comparison failed") {
        super();
        this.message = message;
        this.name = this.constructor.name;
    }
}
exports.AssertViewError = AssertViewError;
//# sourceMappingURL=assert-view-error.js.map