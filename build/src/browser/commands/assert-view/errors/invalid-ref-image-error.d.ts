import { BaseStateError } from "./base-state-error";
import { ImageInfo, RefImageInfo } from "../../../../types";
type InvalidRefImageErrorConstructor<T> = new (stateName: string, currImg: ImageInfo, refImg: RefImageInfo) => T;
export declare class InvalidRefImageError extends BaseStateError {
    constructor(stateName: string, currImg: ImageInfo, refImg: RefImageInfo);
    static fromObject<T extends InvalidRefImageError>(this: InvalidRefImageErrorConstructor<T>, data: InvalidRefImageError): T;
}
export {};
