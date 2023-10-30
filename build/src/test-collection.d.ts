import type { RootSuite, Test } from "./types";
type TestsCallback<T> = (test: Test, browserId: string) => T;
type SortTestsCallback = (test1: Test, test2: Test) => number;
export declare class TestCollection {
    #private;
    static create<T extends TestCollection>(this: new (specs: Record<string, Test[]>) => T, specs: Record<string, Test[]>): T;
    constructor(specs: Record<string, Test[]>);
    getRootSuite(browserId: string): RootSuite;
    eachRootSuite(cb: (root: RootSuite, browserId: string) => void): void;
    getBrowsers(): string[];
    mapTests<T>(cb: TestsCallback<T>): T[];
    mapTests<T>(browserId: string | undefined, cb: TestsCallback<T>): T[];
    sortTests(callback: SortTestsCallback): this;
    sortTests(browserId: string | undefined, callback: SortTestsCallback): this;
    eachTest(callback: TestsCallback<void>): void;
    eachTest(browserId: string | undefined, callback: TestsCallback<void>): void;
    eachTestByVersions(browserId: string, cb: (test: Test, browserId: string, browserVersion: string) => void): void;
    disableAll(browserId?: string): this;
    disableTest(fullTitle: string, browserId?: string): this;
    enableAll(browserId?: string): this;
    enableTest(fullTitle: string, browserId?: string): this;
}
export {};
