import { TestSet } from "./test-set";
export declare class SetCollection {
    #private;
    static create(sets: Record<string, TestSet>): SetCollection;
    constructor(sets: Record<string, TestSet>);
    groupByFile(): Record<string, unknown>;
    getAllFiles(): string[];
    groupByBrowser(): Record<string, string[]>;
}
