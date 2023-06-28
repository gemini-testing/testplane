"use strict";
const Image = require("../../../../image");
const BaseStateError = require("./base-state-error");
module.exports = class ImageDiffError extends BaseStateError {
    static create(...args) {
        return new this(...args);
    }
    static fromObject(data) {
        const { diffBounds, diffClusters } = data;
        return new ImageDiffError(data.stateName, data.currImg, data.refImg, data.diffOpts, {
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
        return Image.buildDiff(Object.assign({ diff: diffPath }, this.diffOpts));
    }
};
//# sourceMappingURL=image-diff-error.js.map