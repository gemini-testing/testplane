/// <reference types="node" />
import { ImageInfo } from "../../../../types";
import { BaseStateError } from "./base-state-error";
import type { LooksSameOptions, LooksSameResult } from "looks-same";
interface DiffOptions extends LooksSameOptions {
    /** Path to the current screenshot */
    current: string;
    reference: string;
    diffColor: string;
}
type DiffAreas = Pick<LooksSameResult, "diffClusters" | "diffBounds">;
type ImageDiffErrorConstructor<T> = new (stateName: string, currImg: ImageInfo, refImg: ImageInfo, diffOpts: DiffOptions, diffAreas: DiffAreas, diffBuffer: Buffer) => T;
interface ImageDiffErrorData {
    stateName: string;
    currImg: ImageInfo;
    refImg: ImageInfo;
    diffOpts: DiffOptions;
    diffBounds: LooksSameResult["diffBounds"];
    diffClusters: LooksSameResult["diffClusters"];
    diffBuffer: Buffer;
}
export declare class ImageDiffError extends BaseStateError {
    message: string;
    diffOpts: DiffOptions;
    diffBounds?: DiffAreas["diffBounds"];
    diffClusters?: DiffAreas["diffClusters"];
    diffBuffer: Buffer;
    static create<T extends ImageDiffError>(this: ImageDiffErrorConstructor<T>, stateName: string, currImg: ImageInfo, refImg: ImageInfo, diffOpts: DiffOptions, diffAreas: DiffAreas | undefined, diffBuffer: Buffer): T;
    static fromObject<T>(this: ImageDiffErrorConstructor<T>, data: ImageDiffErrorData): T;
    constructor(stateName: string, currImg: ImageInfo, refImg: ImageInfo, diffOpts: DiffOptions, { diffBounds, diffClusters }: DiffAreas | undefined, diffBuffer: Buffer);
    saveDiffTo(diffPath: string): Promise<null>;
}
export {};
