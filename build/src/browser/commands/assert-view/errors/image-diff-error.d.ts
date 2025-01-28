/// <reference types="node" />
import { ImageInfo, RefImageInfo } from "../../../../types";
import { BaseStateError } from "./base-state-error";
import type { LooksSameOptions, LooksSameResult } from "looks-same";
interface DiffOptions extends LooksSameOptions {
    /** Path to the current screenshot */
    current: string;
    reference: string;
    diffColor: string;
}
type DiffAreas = Pick<LooksSameResult, "diffClusters" | "diffBounds">;
type ImageDiffErrorConstructor<T> = new (params: {
    stateName: string;
    currImg: ImageInfo;
    refImg: RefImageInfo;
    diffOpts: DiffOptions;
    diffAreas: DiffAreas;
    diffBuffer: Buffer;
    differentPixels: number;
    diffRatio: number;
}) => T;
interface ImageDiffErrorData {
    stateName: string;
    currImg: ImageInfo;
    refImg: RefImageInfo;
    diffOpts: DiffOptions;
    diffBounds: LooksSameResult["diffBounds"];
    diffClusters: LooksSameResult["diffClusters"];
    diffBuffer: Buffer;
    differentPixels: number;
    diffRatio: number;
}
/**
 * @category Errors
 */
export declare class ImageDiffError extends BaseStateError {
    message: string;
    diffOpts: DiffOptions;
    diffBounds?: DiffAreas["diffBounds"];
    diffClusters?: DiffAreas["diffClusters"];
    diffBuffer: Buffer;
    differentPixels: number;
    diffRatio: number;
    static create<T extends ImageDiffError>(this: ImageDiffErrorConstructor<T>, { stateName, currImg, refImg, diffOpts, diffAreas, diffBuffer, differentPixels, diffRatio, }: {
        stateName: string;
        currImg: ImageInfo;
        refImg: RefImageInfo;
        diffOpts: DiffOptions;
        diffAreas?: DiffAreas;
        diffBuffer: Buffer;
        differentPixels: number;
        diffRatio: number;
    }): T;
    static fromObject<T>(this: ImageDiffErrorConstructor<T>, data: ImageDiffErrorData): T;
    constructor({ stateName, currImg, refImg, diffOpts, diffAreas: { diffBounds, diffClusters }, diffBuffer, differentPixels, diffRatio, }: {
        stateName: string;
        currImg: ImageInfo;
        refImg: RefImageInfo;
        diffOpts: DiffOptions;
        diffAreas?: DiffAreas;
        diffBuffer: Buffer;
        differentPixels: number;
        diffRatio: number;
    });
    saveDiffTo(diffPath: string): Promise<null>;
}
export {};
