export = NoRefImageError;
declare class NoRefImageError extends BaseStateError {
    static create(...args: any[]): import("./no-ref-image-error");
    static fromObject(data: any): import("./no-ref-image-error");
    constructor(stateName: any, currImg: any, refImg: any);
}
import BaseStateError = require("./base-state-error");
