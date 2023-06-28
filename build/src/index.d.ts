import "../typings/global";
import "./browser/types";
import "expect-webdriverio";
import { GlobalHelper } from "./types";
export { Hermione as default } from "./hermione";
export type { WdioBrowser } from "./types";
export type { Config } from "./config";
export type { ConfigInput } from "./config/types";
declare global {
    const hermione: GlobalHelper;
}
