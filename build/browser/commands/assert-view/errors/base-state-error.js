'use strict';
module.exports = class BaseStateError extends Error {
    constructor(stateName, currImg = {}, refImg = {}) {
        super();
        this.name = this.constructor.name;
        this.stateName = stateName;
        this.currImg = currImg;
        this.refImg = refImg;
    }
};
