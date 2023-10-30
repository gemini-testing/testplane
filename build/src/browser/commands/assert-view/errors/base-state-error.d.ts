import { ImageInfo } from "../../../../types";
export declare class BaseStateError extends Error {
    stateName: string;
    currImg: ImageInfo;
    refImg: ImageInfo;
    constructor(stateName: string, currImg: ImageInfo, refImg: ImageInfo);
}
