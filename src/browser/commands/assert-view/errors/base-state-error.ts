import type { ImageInfo, RefImageInfo } from "../../../../types";

export class BaseStateError extends Error {
    constructor(public stateName: string, public currImg: ImageInfo, public refImg: RefImageInfo) {
        super();

        this.name = this.constructor.name;
    }
}
