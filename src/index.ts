// Declares global hooks
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../typings/global.d.ts" />
// Augments browser and element methods
import "./browser/types";
// Declares global expect function
import "expect-webdriverio";

import { GlobalHelper } from "./types";
export { run as runCli } from "./cli";
export { Testplane as default } from "./testplane";
export { Key } from "@testplane/webdriverio";
export * from "./mock";

export * as unstable from "./unstable";

export type { SessionOptions } from "./browser/types";

export type {
    WdioBrowser,
    TestResult,
    Test,
    Suite,
    TestError,
    HermioneCtx,
    GlobalHelper,
    TestplaneCtx,
    TestFunction,
    TestFunctionCtx,
    ExecutionThreadCtx,
} from "./types";
export type { Config } from "./config";
export { TimeTravelMode } from "./config";
export type { ConfigInput, AssertViewOpts } from "./config/types";
export type {
    TestCollection,
    FormatterTreeSuite,
    FormatterTreeTest,
    FormatterTreeMainRunnable,
    FormatterListTest,
} from "./test-collection";
export type { StatsResult } from "./stats";
export type { SaveStateData } from "./browser/commands/saveState";

import type { TestDefinition, SuiteDefinition, TestHookDefinition } from "./test-reader/test-object/types";
export type { TestDefinition, SuiteDefinition, TestHookDefinition };

declare global {
    /* eslint-disable no-var */
    // Here, we ignore clashes of types between Mocha and Testplane, because in production we don't include @types/mocha,
    // but we need mocha types in development, so this is an issue only during development.
    ///@ts-expect-error: see explanation above
    var it: TestDefinition;
    // @ts-expect-error: see explanation above
    var describe: SuiteDefinition;
    // @ts-expect-error: see explanation above
    var beforeEach: TestHookDefinition;
    // @ts-expect-error: see explanation above
    var afterEach: TestHookDefinition;

    var testplane: GlobalHelper;
    /**
     * @deprecated Use `testplane` instead
     */
    var hermione: GlobalHelper;
    /* eslint-enable no-var */
}
