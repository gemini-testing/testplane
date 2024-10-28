import { BaseStateError } from "./base-state-error";
import { ImageInfo, RefImageInfo } from "../../../../types";

type InvalidRefImageErrorConstructor<T> = new (stateName: string, currImg: ImageInfo, refImg: RefImageInfo) => T;

export class InvalidRefImageError extends BaseStateError {
    constructor(stateName: string, currImg: ImageInfo, refImg: RefImageInfo) {
        super(stateName, currImg, refImg);

        this.message = `reference image at ${refImg.path} is not a valid png`;
    }

    static fromObject<T extends InvalidRefImageError>(
        this: InvalidRefImageErrorConstructor<T>,
        data: InvalidRefImageError,
    ): T {
        return new this(data.stateName, data.currImg, data.refImg);
    }
}
