import { Testplane } from "./testplane";
export interface StatsResult {
    total: number;
    passed: number;
    failed: number;
    retries: number;
    skipped: number;
    perBrowser: Record<string, Omit<StatsResult, "perBrowser">>;
}
export declare class Stats {
    private events;
    static create<T extends Stats>(this: new (runner?: Testplane) => T, runner?: Testplane): T;
    constructor(runner?: Testplane);
    getResult(): StatsResult;
}
