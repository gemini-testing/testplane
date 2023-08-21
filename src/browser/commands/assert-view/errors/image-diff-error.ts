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

type ImageDiffErrorConstructor<T> = new (
    stateName: string,
    currImg: ImageInfo,
    refImg: ImageInfo,
    diffOpts: DiffOptions,
    diffAreas: DiffAreas,
    diffBuffer: Buffer,
) => T;

interface ImageDiffErrorData {
    stateName: string;
    currImg: ImageInfo;
    refImg: ImageInfo;
    diffOpts: DiffOptions;
    diffBounds: LooksSameResult["diffBounds"];
    diffClusters: LooksSameResult["diffClusters"];
    diffBuffer: Buffer;
}

export class ImageDiffError extends BaseStateError {
    message: string;
    diffOpts: DiffOptions;
    diffBounds?: DiffAreas["diffBounds"];
    diffClusters?: DiffAreas["diffClusters"];
    diffBuffer: Buffer;

    static create<T extends ImageDiffError>(
        this: ImageDiffErrorConstructor<T>,
        stateName: string,
        currImg: ImageInfo,
        refImg: ImageInfo,
        diffOpts: DiffOptions,
        diffAreas = {} as DiffAreas,
        diffBuffer: Buffer,
    ): T {
        return new this(stateName, currImg, refImg, diffOpts, diffAreas, diffBuffer);
    }

    static fromObject<T>(this: ImageDiffErrorConstructor<T>, data: ImageDiffErrorData): T {
        const { diffBounds, diffClusters } = data;
        return new this(
            data.stateName,
            data.currImg,
            data.refImg,
            data.diffOpts,
            {
                diffBounds,
                diffClusters,
            },
            data.diffBuffer,
        );
    }

    constructor(
        stateName: string,
        currImg: ImageInfo,
        refImg: ImageInfo,
        diffOpts: DiffOptions,
        { diffBounds, diffClusters } = {} as DiffAreas,
        diffBuffer: Buffer,
    ) {
        super(stateName, currImg, refImg);

        this.message = `images are different for "${stateName}" state`;
        this.diffOpts = diffOpts;
        this.diffBounds = diffBounds;
        this.diffClusters = diffClusters;
        this.diffBuffer = diffBuffer;
    }

    saveDiffTo(diffPath: string): Promise<null> {
        return Image.buildDiff({ diff: diffPath, ...this.diffOpts });
    }
}
