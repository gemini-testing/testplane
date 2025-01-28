export = AssertViewResults;
declare class AssertViewResults {
    static fromRawObject(results: any): import("./assert-view-results");
    static create(results: any): import("./assert-view-results");
    constructor(results: any);
    _results: any;
    add(data: any): void;
    hasFails(): any;
    hasState(stateName: any): any;
    toRawObject(): any;
    get(): any;
}
