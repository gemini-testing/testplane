import { BaseStateError } from "./base-state-error";
import { ImageInfo, RefImageInfo } from "../../../../types";

type NoRefImageErrorConstructor<T> = new (stateName: string, currImg: ImageInfo, refImg: RefImageInfo) => T;

interface NoRefImageErrorData {
    stateName: string;
    currImg: ImageInfo;
    refImg: RefImageInfo;
}

/**
 * @category Errors
 */
export class NoRefImageError extends BaseStateError {
    static create<T extends NoRefImageError>(
        this: NoRefImageErrorConstructor<T>,
        stateName: string,
        currImg: ImageInfo,
        refImg: RefImageInfo,
    ): T {
        return new this(stateName, currImg, refImg);
    }

    static fromObject<T extends NoRefImageError>(this: NoRefImageErrorConstructor<T>, data: NoRefImageErrorData): T {
        return new this(data.stateName, data.currImg, data.refImg);
    }

    constructor(stateName: string, currImg: ImageInfo, refImg: RefImageInfo) {
        super(stateName, currImg, refImg);

        this.message = `can not find reference image at ${this.refImg.path} for "${stateName}" state`;
    }
}
