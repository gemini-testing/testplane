import { Formatters } from "./constants";
import type { ValueOf } from "../types/helpers";
import type { RootSuite, Test } from "../types";
export * from "./constants";
export type FormatterTreeSuite = {
    id: string;
    title: string;
    line: number;
    column: number;
    suites: FormatterTreeSuite[];
    tests: FormatterTreeTest[];
    pending: boolean;
    skipReason: string;
};
export type FormatterTreeTest = Omit<FormatterTreeSuite, "suites" | "tests"> & {
    browserIds: string[];
};
export type FormatterTreeMainRunnable = (FormatterTreeSuite | FormatterTreeTest) & {
    file: string;
};
export type FormatterListTest = {
    id: string;
    titlePath: string[];
    file: string;
    browserIds: string[];
    pending: boolean;
    skipReason: string;
};
export type TestDisabled = Test & {
    disabled: true;
};
type TestsCallback<T> = (test: Test, browserId: string) => T;
type SortTestsCallback = (test1: Test, test2: Test) => number;
export declare class TestCollection {
    #private;
    static create<T extends TestCollection>(this: new (specs: Record<string, Test[]>) => T, specs: Record<string, Test[]>): T;
    constructor(specs: Record<string, Test[]>);
    get formatters(): typeof Formatters;
    getRootSuite(browserId: string): RootSuite | null;
    eachRootSuite(cb: (root: RootSuite, browserId: string) => void): void;
    getBrowsers(): string[];
    mapTests<T>(cb: TestsCallback<T>): T[];
    mapTests<T>(browserId: string | undefined, cb: TestsCallback<T>): T[];
    sortTests(callback: SortTestsCallback): this;
    sortTests(browserId: string | undefined, callback: SortTestsCallback): this;
    eachTest(callback: TestsCallback<void>): void;
    eachTest(browserId: string | undefined, callback: TestsCallback<void>): void;
    eachTestByVersions(browserId: string, cb: (test: Test, browserId: string, browserVersion?: string) => void): void;
    disableAll(browserId?: string): this;
    disableTest(fullTitle: string, browserId?: string): this;
    enableAll(browserId?: string): this;
    enableTest(fullTitle: string, browserId?: string): this;
    format(formatterType: ValueOf<typeof Formatters>): (FormatterListTest | FormatterTreeMainRunnable)[];
}
export declare function validateFormatter(formatterType: ValueOf<typeof Formatters>): void;
