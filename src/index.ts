// Declares global hooks
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../typings/global.d.ts" />
// Augments browser and element methods
import "./browser/types";
// Declares global expect function
import "expect-webdriverio";

export { run as runCli } from "./cli";
export { Testplane as default } from "./testplane";
export { Key } from "@testplane/webdriverio";
export * from "./mock";
export * from "./globals";

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
    Cookie,
    TestTag,
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
