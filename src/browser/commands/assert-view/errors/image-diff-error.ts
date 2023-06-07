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
) => T;

interface ImageDiffErrorData {
    stateName: string;
    currImg: ImageInfo;
    refImg: ImageInfo;
    diffOpts: DiffOptions;
    diffBounds: LooksSameResult["diffBounds"];
    diffClusters: LooksSameResult["diffClusters"];
}

export class ImageDiffError extends BaseStateError {
    message: string;
    diffOpts: DiffOptions;
    diffBounds?: DiffAreas["diffBounds"];
    diffClusters?: DiffAreas["diffClusters"];

    static create<T extends ImageDiffError>(
        this: ImageDiffErrorConstructor<T>,
        stateName: string,
        currImg: ImageInfo,
        refImg: ImageInfo,
        diffOpts: DiffOptions,
        diffAreas: DiffAreas = {},
    ): T {
        return new this(stateName, currImg, refImg, diffOpts, diffAreas);
    }

    static fromObject<T>(this: ImageDiffErrorConstructor<T>, data: ImageDiffErrorData): T {
        const { diffBounds, diffClusters } = data;
        return new this(data.stateName, data.currImg, data.refImg, data.diffOpts, {
            diffBounds,
            diffClusters,
        });
    }

    constructor(
        stateName: string,
        currImg: ImageInfo,
        refImg: ImageInfo,
        diffOpts: DiffOptions,
        { diffBounds, diffClusters }: DiffAreas = {},
    ) {
        super(stateName, currImg, refImg);

        this.message = `images are different for "${stateName}" state`;
        this.diffOpts = diffOpts;
        this.diffBounds = diffBounds;
        this.diffClusters = diffClusters;
    }

    saveDiffTo(diffPath: string): Promise<null> {
        return Image.buildDiff({ diff: diffPath, ...this.diffOpts });
    }
}
