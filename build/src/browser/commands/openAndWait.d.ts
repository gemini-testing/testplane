import type { Browser } from "../types";
import { BrowserConfig } from "../../config/browser-config";
interface WaitOpts {
    selector?: string | string[];
    predicate?: () => boolean;
    waitNetworkIdle?: boolean;
    waitNetworkIdleTimeout?: number;
    failOnNetworkError?: boolean;
    shouldThrowError?: (match: any) => boolean;
    ignoreNetworkErrorsPatterns?: Array<RegExp | string>;
    timeout?: number;
}
declare const makeOpenAndWaitCommand: (config: BrowserConfig, session: WebdriverIO.Browser) => (this: WebdriverIO.Browser, uri: string, { selector, predicate, waitNetworkIdle, waitNetworkIdleTimeout, failOnNetworkError, shouldThrowError, ignoreNetworkErrorsPatterns, timeout, }?: WaitOpts) => Promise<string | void>;
export type OpenAndWaitCommand = ReturnType<typeof makeOpenAndWaitCommand>;
declare const _default: (browser: Browser) => void;
export default _default;
