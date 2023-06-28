export class SkipController {
    static create(...args: any[]): SkipController;
    constructor(eventBus: any);
    in(matchers: any, reason: any, { silent }?: {
        silent: any;
    }): SkipController;
    notIn(matchers: any, reason: any, { silent }?: {
        silent: any;
    }): SkipController;
    #private;
}
