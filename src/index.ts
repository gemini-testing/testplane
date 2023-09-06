// Declares global hooks
import "../typings/global";
// Augments browser and element methods
import "./browser/types";
// Declares global expect function
import "expect-webdriverio";

import { GlobalHelper } from "./types";
export { Hermione as default } from "./hermione";

export type { WdioBrowser, TestResult, Suite } from "./types";
export type { Config } from "./config";
export type { ConfigInput } from "./config/types";

declare global {
    const hermione: GlobalHelper;
}
