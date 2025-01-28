import { ConfigurableTestObject } from "./configurable-test-object";
import { Hook } from "./hook";
import { Test } from "./test";
import type { TestObjectData, ConfigurableTestObjectData, TestFunction, TestFunctionCtx } from "./types";
type SuiteOpts = Pick<ConfigurableTestObjectData, "file" | "id" | "location"> & TestObjectData;
export declare class Suite extends ConfigurableTestObject {
    #private;
    static create<T extends Suite>(this: new (opts: SuiteOpts) => T, opts: SuiteOpts): T;
    constructor({ title, file, id, location }?: SuiteOpts);
    addSuite(suite: Suite): this;
    addTest(test: Test): this;
    addBeforeEachHook(hook: Hook): this;
    addAfterEachHook(hook: Hook): this;
    beforeEach(fn: TestFunction<TestFunctionCtx>): this;
    afterEach(fn: TestFunction<TestFunctionCtx>): this;
    eachTest(cb: (test: Test) => void): void;
    getTests(): Test[];
    filterTests(cb: (test: Test) => unknown): this;
    get root(): boolean;
    get suites(): Suite[];
    get tests(): Test[];
    get beforeEachHooks(): Hook[];
    get afterEachHooks(): Hook[];
}
export {};
