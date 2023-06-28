export = Stats;
declare class Stats {
    static create(...args: any[]): import("./stats");
    constructor(runner: any);
    _events: any[];
    getResult(): any;
}
