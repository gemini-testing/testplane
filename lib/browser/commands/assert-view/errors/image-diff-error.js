'use strict';

const {Image} = require('gemini-core');
const BaseStateError = require('./base-state-error');

module.exports = class ImageDiffError extends BaseStateError {
    static create(...args) {
        return new this(...args);
    }

    static fromObject(data) {
        return new ImageDiffError(data.stateName, data.currImg, data.refImg, data.diffOpts);
    }

    constructor(stateName, currImg, refImg, diffOpts) {
        super(stateName, currImg, refImg);

        this.message = `images are different for "${stateName}" state`;
        this.diffOpts = diffOpts;
    }

    saveDiffTo(diffPath) {
        return Image.buildDiff({diff: diffPath, ...this.diffOpts});
    }
};
