//TODO

import { Image } from 'gemini-core';
import BaseStateError from './base-state-error';

export default class ImageDiffError extends BaseStateError {
    public diffOpts: object;
    public diffBounds: object;
    public diffClusters: object;

    static create(...args) {
        return new this(...args);
    }

    static fromObject(data: object): ImageDiffError {
        const {diffBounds, diffClusters} = data;
        return new ImageDiffError(data.stateName, data.currImg, data.refImg, data.diffOpts, {diffBounds, diffClusters});
    }

    constructor(
        stateName: string,
        currImg: object,
        refImg: object,
        diffOpts: object,
        {diffBounds, diffClusters} = {}
    ) {
        super(stateName, currImg, refImg);

        this.message = `images are different for "${stateName}" state`;
        this.diffOpts = diffOpts;
        this.diffBounds = diffBounds;
        this.diffClusters = diffClusters;
    }

    saveDiffTo(diffPath) {
        return Image.buildDiff({diff: diffPath, ...this.diffOpts});
    }
};
