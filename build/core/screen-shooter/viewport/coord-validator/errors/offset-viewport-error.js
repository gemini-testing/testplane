"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Position of an element is outside of a viewport left, top or right bounds
 */
class OffsetViewportError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}
exports.default = OffsetViewportError;
