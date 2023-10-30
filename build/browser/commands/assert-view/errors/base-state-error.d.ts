export = BaseStateError;
declare class BaseStateError extends Error {
    constructor(stateName: any, currImg?: {}, refImg?: {});
    stateName: any;
    currImg: {};
    refImg: {};
}
