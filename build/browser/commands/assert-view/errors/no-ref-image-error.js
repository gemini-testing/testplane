"use strict";
const BaseStateError = require("./base-state-error");
module.exports = class NoRefImageError extends BaseStateError {
    static create(...args) {
        return new this(...args);
    }
    static fromObject(data) {
        return new NoRefImageError(data.stateName, data.currImg, data.refImg);
    }
    constructor(stateName, currImg, refImg) {
        super(stateName, currImg, refImg);
        this.message = `can not find reference image at ${this.refImg.path} for "${stateName}" state`;
    }
};
//# sourceMappingURL=no-ref-image-error.js.map