import { ImageInfo } from "../../../../types";

export class BaseStateError extends Error {
    constructor(public stateName: string, public currImg: ImageInfo, public refImg: ImageInfo) {
        super();

        this.name = this.constructor.name;
    }
}
