'use strict';

const {Image} = require('gemini-core');
const BaseStateError = require('./base-state-error');

module.exports = class ImageDiffError extends BaseStateError {
    static fromObject(data) {
        const {diffBounds, stateName, currentImagePath, refImagePath, diffOpts} = data;
        return new ImageDiffError(stateName, currentImagePath, refImagePath, diffBounds, diffOpts);
    }

    constructor(stateName, currentPath, refImagePath, diffBounds, diffOpts) {
        super(stateName, currentPath, refImagePath);

        this.message = `images are different for "${stateName}" state`;
        this.diffOpts = diffOpts;
        this.diffBounds = diffBounds;
    }

    saveDiffTo(diffPath) {
        return Image.buildDiff({diff: diffPath, ...this.diffOpts});
    }
};
