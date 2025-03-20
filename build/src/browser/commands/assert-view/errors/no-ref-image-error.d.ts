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
export declare class NoRefImageError extends BaseStateError {
    static create<T extends NoRefImageError>(this: NoRefImageErrorConstructor<T>, stateName: string, currImg: ImageInfo, refImg: RefImageInfo): T;
    static fromObject<T extends NoRefImageError>(this: NoRefImageErrorConstructor<T>, data: NoRefImageErrorData): T;
    constructor(stateName: string, currImg: ImageInfo, refImg: RefImageInfo);
}
export {};
