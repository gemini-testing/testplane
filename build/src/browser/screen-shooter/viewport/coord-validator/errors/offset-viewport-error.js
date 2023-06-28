"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OffsetViewportError = void 0;
/**
 * Position of an element is outside of a viewport left, top or right bounds
 */
class OffsetViewportError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}
exports.OffsetViewportError = OffsetViewportError;
//# sourceMappingURL=offset-viewport-error.js.map