"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageDiffError = void 0;
const image_1 = __importDefault(require("../../../../image"));
const base_state_error_1 = require("./base-state-error");
class ImageDiffError extends base_state_error_1.BaseStateError {
    static create(stateName, currImg, refImg, diffOpts, diffAreas = {}) {
        return new this(stateName, currImg, refImg, diffOpts, diffAreas);
    }
    static fromObject(data) {
        const { diffBounds, diffClusters } = data;
        return new this(data.stateName, data.currImg, data.refImg, data.diffOpts, {
            diffBounds,
            diffClusters,
        });
    }
    constructor(stateName, currImg, refImg, diffOpts, { diffBounds, diffClusters } = {}) {
        super(stateName, currImg, refImg);
        this.message = `images are different for "${stateName}" state`;
        this.diffOpts = diffOpts;
        this.diffBounds = diffBounds;
        this.diffClusters = diffClusters;
    }
    saveDiffTo(diffPath) {
        return image_1.default.buildDiff({ diff: diffPath, ...this.diffOpts });
    }
}
exports.ImageDiffError = ImageDiffError;
//# sourceMappingURL=image-diff-error.js.map