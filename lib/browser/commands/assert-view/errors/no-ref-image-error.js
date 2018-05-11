'use strict';

const BaseSateError = require('./base-state-error');

module.exports = class NoRefImageError extends BaseSateError {
    static fromObject(data) {
        return new NoRefImageError(data.stateName, data.currentImagePath, data.refImagePath);
    }

    constructor(stateName, currPath, refPath) {
        super(stateName, currPath, refPath);

        this.message = `can not find reference image at ${refPath} for "${stateName}" state`;
    }
};
