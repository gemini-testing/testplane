"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeightViewportError = void 0;
/**
 * Height of the element is larger than viewport
 * @category Errors
 */
class HeightViewportError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}
exports.HeightViewportError = HeightViewportError;
//# sourceMappingURL=height-viewport-error.js.map