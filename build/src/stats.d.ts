import { Hermione } from "./hermione";
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
    static create<T extends Stats>(this: new (runner?: Hermione) => T, runner?: Hermione): T;
    constructor(runner?: Hermione);
    getResult(): StatsResult;
}
