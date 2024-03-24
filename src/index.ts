// Declares global hooks
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../typings/global.d.ts" />
// Augments browser and element methods
import "./browser/types.js";
// Declares global expect function
import "expect-webdriverio";

import { GlobalHelper } from "./types/index.js";
export { Hermione as default } from "./hermione.js";

export type { WdioBrowser, TestResult, Test, Suite, TestError, AssertViewOpts } from "./types/index.js";
export type { Config } from "./config/index.js";
export type { ConfigInput } from "./config/types.js";
export type { TestCollection } from "./test-collection.js";

declare global {
    const hermione: GlobalHelper;
}
