'use strict';

module.exports = class AssertViewError extends Error {
    constructor(stateName, currentImagePath) {
        super();

        this.stateName = stateName;
        this.currentImagePath = currentImagePath;
    }
};
