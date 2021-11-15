//TODO

import BaseSateError from './base-state-error';

export default class NoRefImageError extends BaseSateError {
    static create(...args) {
        return new this(...args);
    }

    static fromObject(data: object): NoRefImageError {
        return new NoRefImageError(data.stateName, data.currImg, data.refImg);
    }

    constructor(stateName: string, currImg: object, refImg: object) {
        super(stateName, currImg, refImg);

        this.message = `can not find reference image at ${this.refImg.path} for "${stateName}" state`;
    }
};
