// Declares global hooks
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../typings/global.d.ts" />
// Augments browser and element methods
import "./browser/types";
// Declares global expect function
import "expect-webdriverio";

import { GlobalHelper } from "./types";
export { Hermione as default } from "./hermione";

export type { WdioBrowser, TestResult, Test, Suite, TestError } from "./types";
export type { Config } from "./config";
export type { ConfigInput } from "./config/types";
export type { TestCollection } from "./test-collection";

declare global {
    const hermione: GlobalHelper;
}
