import { ImageInfo } from "../../../../types";

import Image from "../../../../image";
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
    refImg: ImageInfo;
    diffOpts: DiffOptions;
    diffAreas: DiffAreas;
    diffBuffer: Buffer;
    differentPixels: number;
    diffRatio: number;
}) => T;

interface ImageDiffErrorData {
    stateName: string;
    currImg: ImageInfo;
    refImg: ImageInfo;
    diffOpts: DiffOptions;
    diffBounds: LooksSameResult["diffBounds"];
    diffClusters: LooksSameResult["diffClusters"];
    diffBuffer: Buffer;
    differentPixels: number;
    diffRatio: number;
}

export class ImageDiffError extends BaseStateError {
    message: string;
    diffOpts: DiffOptions;
    diffBounds?: DiffAreas["diffBounds"];
    diffClusters?: DiffAreas["diffClusters"];
    diffBuffer: Buffer;
    differentPixels: number;
    diffRatio: number;

    static create<T extends ImageDiffError>(
        this: ImageDiffErrorConstructor<T>,
        {
            stateName,
            currImg,
            refImg,
            diffOpts,
            diffAreas = {} as DiffAreas,
            diffBuffer,
            differentPixels,
            diffRatio,
        }: {
            stateName: string;
            currImg: ImageInfo;
            refImg: ImageInfo;
            diffOpts: DiffOptions;
            diffAreas?: DiffAreas;
            diffBuffer: Buffer;
            differentPixels: number;
            diffRatio: number;
        },
    ): T {
        return new this({ stateName, currImg, refImg, diffOpts, diffAreas, diffBuffer, differentPixels, diffRatio });
    }

    static fromObject<T>(this: ImageDiffErrorConstructor<T>, data: ImageDiffErrorData): T {
        const { diffBounds, diffClusters, ...rest } = data;
        return new this({ ...rest, diffAreas: { diffBounds, diffClusters } });
    }

    constructor({
        stateName,
        currImg,
        refImg,
        diffOpts,
        diffAreas: { diffBounds, diffClusters } = {} as DiffAreas,
        diffBuffer,
        differentPixels,
        diffRatio,
    }: {
        stateName: string;
        currImg: ImageInfo;
        refImg: ImageInfo;
        diffOpts: DiffOptions;
        diffAreas?: DiffAreas;
        diffBuffer: Buffer;
        differentPixels: number;
        diffRatio: number;
    }) {
        super(stateName, currImg, refImg);

        this.message = `images are different for "${stateName}" state`;
        this.diffOpts = diffOpts;
        this.diffBounds = diffBounds;
        this.diffClusters = diffClusters;
        this.diffBuffer = diffBuffer;
        this.differentPixels = differentPixels;
        this.diffRatio = diffRatio;
    }

    saveDiffTo(diffPath: string): Promise<null> {
        return Image.buildDiff({ diff: diffPath, ...this.diffOpts });
    }
}
