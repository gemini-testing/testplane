'use strict';

module.exports = class BaseStateError extends Error {
    constructor(stateName, currentImagePath, refImagePath) {
        super();

        this.name = this.constructor.name;
        this.stateName = stateName;
        this.currentImagePath = currentImagePath;
        this.refImagePath = refImagePath;
    }
};
