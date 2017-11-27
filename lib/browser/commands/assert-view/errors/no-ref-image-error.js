'use strict';

const AssertViewError = require('./assert-view-error');

module.exports = class NoRefImageError extends AssertViewError {
    constructor(stateName, currPath, refPath) {
        super(stateName, currPath);

        this.name = 'NoRefImageError';
        this.message = `can not find reference image at ${refPath} for "${stateName}" state.`;
    }
};
