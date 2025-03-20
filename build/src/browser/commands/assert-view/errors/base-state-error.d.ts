import { ImageInfo, RefImageInfo } from "../../../../types";
export declare class BaseStateError extends Error {
    stateName: string;
    currImg: ImageInfo;
    refImg: RefImageInfo;
    constructor(stateName: string, currImg: ImageInfo, refImg: RefImageInfo);
}
