'use strict';

const AssertViewError = require('./assert-view-error');
const errors = require('../../../../constants/errors');

module.exports = class ImageDiffError extends AssertViewError {
    constructor(stateName, currPath, refPath, diffOpts) {
        super(stateName, currPath);

        this.name = errors.IMAGE_DIFF_ERROR;
        this.message = `images are different for "${stateName}" state.`;
        this.refImagePath = refPath;
        this.diffOpts = diffOpts;
    }
};
