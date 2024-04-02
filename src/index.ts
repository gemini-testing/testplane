// Declares global hooks
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../typings/global.d.ts" />
// Augments browser and element methods
import "./browser/types";
// Declares global expect function
import "expect-webdriverio";

import { GlobalHelper } from "./types";
export { Testplane as default } from "./testplane";
export { Key } from "webdriverio";

export type {
    WdioBrowser,
    TestResult,
    Test,
    Suite,
    TestError,
    AssertViewOpts,
    HermioneCtx,
    GlobalHelper,
    TestplaneCtx,
} from "./types";
export type { Config } from "./config";
export type { ConfigInput } from "./config/types";
export type { TestCollection } from "./test-collection";

declare global {
    const testplane: GlobalHelper;
    /**
     * @deprecated Use `testplane` instead
     */
    const hermione: GlobalHelper;
}
