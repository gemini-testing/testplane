'use strict';

const {Image} = require('gemini-core');
const BaseStateError = require('./base-state-error');

module.exports = class ImageDiffError extends BaseStateError {
    static fromObject(data) {
        return new ImageDiffError(data.stateName, data.currentImagePath, data.refImagePath, data.diffOpts);
    }

    constructor(stateName, currentPath, refImagePath, diffOpts) {
        super(stateName, currentPath, refImagePath);

        this.message = `images are different for "${stateName}" state`;
        this.diffOpts = diffOpts;
    }

    saveDiffTo(diffPath) {
        return Image.buildDiff({diff: diffPath, ...this.diffOpts});
    }
};
