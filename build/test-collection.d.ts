import type { Suite } from "./test-reader/test-object/suite";
import type { Test } from "./test-reader/test-object/test";
type RootSuite = Suite & {
    root: true;
};
type TestsCallback<T> = (test: Test, browserId: string) => T;
type SortTestsCallback = (test1: Test, test2: Test) => number;
export default class TestCollection {
    #private;
    static create(specs: Record<string, Test[]>): TestCollection;
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
