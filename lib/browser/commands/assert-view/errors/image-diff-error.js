'use strict';

const BaseStateError = require('./base-state-error');

module.exports = class ImageDiffError extends BaseStateError {
    static create(...args) {
        return new this(...args);
    }

    static fromObject(data) {
        const {diffBounds, diffClusters} = data;
        return new ImageDiffError(data.stateName, data.currImg, data.refImg, data.diffImg, {diffBounds, diffClusters});
    }

    constructor(stateName, currImg, refImg, diffImg, {diffBounds, diffClusters} = {}) {
        super(stateName, currImg, refImg);

        this.diffImg = diffImg;
        this.message = `images are different for "${stateName}" state`;
        this.diffBounds = diffBounds;
        this.diffClusters = diffClusters;
    }
};
