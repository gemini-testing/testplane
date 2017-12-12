'use strict';

const AssertViewError = require('./assert-view-error');

module.exports = class ImageDiffError extends AssertViewError {
    constructor(stateName, currPath, refPath, buildDiffFn) {
        super(stateName, currPath);

        this.name = 'ImageDiffError';
        this.message = `images are different for "${stateName}" state.`;
        this.refImagePath = refPath;
        this.saveDiffTo = buildDiffFn;
    }
};
