'use strict';

const AssertViewError = require('./assert-view-error');
const errors = require('../../../../constants/errors');

module.exports = class NoRefImageError extends AssertViewError {
    constructor(stateName, currPath, refPath) {
        super(stateName, currPath);

        this.name = errors.NO_REF_IMAGE_ERROR;
        this.message = `can not find reference image at ${refPath} for "${stateName}" state.`;
    }
};
