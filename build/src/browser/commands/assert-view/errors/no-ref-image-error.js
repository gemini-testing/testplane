"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoRefImageError = void 0;
const base_state_error_1 = require("./base-state-error");
class NoRefImageError extends base_state_error_1.BaseStateError {
    static create(stateName, currImg, refImg) {
        return new this(stateName, currImg, refImg);
    }
    static fromObject(data) {
        return new this(data.stateName, data.currImg, data.refImg);
    }
    constructor(stateName, currImg, refImg) {
        super(stateName, currImg, refImg);
        this.message = `can not find reference image at ${this.refImg.path} for "${stateName}" state`;
    }
}
exports.NoRefImageError = NoRefImageError;
//# sourceMappingURL=no-ref-image-error.js.map