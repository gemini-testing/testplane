"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidRefImageError = void 0;
const base_state_error_1 = require("./base-state-error");
class InvalidRefImageError extends base_state_error_1.BaseStateError {
    constructor(stateName, currImg, refImg) {
        super(stateName, currImg, refImg);
        this.message = `reference image at ${refImg.path} is not a valid png`;
    }
    static fromObject(data) {
        return new this(data.stateName, data.currImg, data.refImg);
    }
}
exports.InvalidRefImageError = InvalidRefImageError;
//# sourceMappingURL=invalid-ref-image-error.js.map