"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseStateError = void 0;
class BaseStateError extends Error {
    constructor(stateName, currImg, refImg) {
        super();
        this.stateName = stateName;
        this.currImg = currImg;
        this.refImg = refImg;
        this.name = this.constructor.name;
    }
}
exports.BaseStateError = BaseStateError;
//# sourceMappingURL=base-state-error.js.map