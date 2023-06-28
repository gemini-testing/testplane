export = ImageDiffError;
declare class ImageDiffError extends BaseStateError {
    static create(...args: any[]): import("./image-diff-error");
    static fromObject(data: any): import("./image-diff-error");
    constructor(stateName: any, currImg: any, refImg: any, diffOpts: any, { diffBounds, diffClusters }?: {
        diffBounds: any;
        diffClusters: any;
    });
    diffOpts: any;
    diffBounds: any;
    diffClusters: any;
    saveDiffTo(diffPath: any): Promise<null>;
}
import BaseStateError = require("./base-state-error");
