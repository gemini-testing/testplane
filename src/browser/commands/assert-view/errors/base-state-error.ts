import { ImageInfo } from "../../../../types/index.js";

export class BaseStateError extends Error {
    constructor(public stateName: string, public currImg: ImageInfo, public refImg: ImageInfo) {
        super();

        this.name = this.constructor.name;
    }
}
