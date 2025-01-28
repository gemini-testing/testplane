/// <reference path="../../typings/global.d.ts" />
/// <reference types="expect-webdriverio/types/expect-webdriverio" />
import "./browser/types";
import "expect-webdriverio";
import { GlobalHelper } from "./types";
export { Testplane as default } from "./testplane";
export { Key } from "@testplane/webdriverio";
export * from "./mock";
export type { WdioBrowser, TestResult, Test, Suite, TestError, HermioneCtx, GlobalHelper, TestplaneCtx, TestFunction, TestFunctionCtx, ExecutionThreadCtx, } from "./types";
export type { Config } from "./config";
export type { ConfigInput, AssertViewOpts } from "./config/types";
export type { TestCollection, FormatterTreeSuite, FormatterTreeTest, FormatterTreeMainRunnable, FormatterListTest, } from "./test-collection";
export type { StatsResult } from "./stats";
import type { TestDefinition, SuiteDefinition, TestHookDefinition } from "./test-reader/test-object/types";
export type { TestDefinition, SuiteDefinition, TestHookDefinition };
declare global {
    var it: TestDefinition;
    var describe: SuiteDefinition;
    var beforeEach: TestHookDefinition;
    var afterEach: TestHookDefinition;
    var testplane: GlobalHelper;
    /**
     * @deprecated Use `testplane` instead
     */
    var hermione: GlobalHelper;
}
