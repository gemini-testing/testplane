"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Height of the element is larger than viewport
 */
class HeightViewportError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}
exports.default = HeightViewportError;
