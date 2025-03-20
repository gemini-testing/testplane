import debug from "debug";
import { BrowserOpts, Pool } from "./types";
import { Browser } from "../browser/browser";
export interface LimitedPoolOpts {
    limit: number;
    isSpecificBrowserLimiter?: boolean;
}
export declare class LimitedPool implements Pool {
    private _limit;
    private _launched;
    private _requests;
    private _requestQueue;
    private _highPriorityRequestQueue;
    private _isSpecificBrowserLimiter;
    log: debug.Debugger;
    underlyingPool: Pool;
    static create(underlyingPool: Pool, opts: LimitedPoolOpts): LimitedPool;
    constructor(underlyingPool: Pool, opts: LimitedPoolOpts);
    getBrowser(id: string, opts?: BrowserOpts): Promise<Browser>;
    freeBrowser(browser: Browser, opts?: BrowserOpts): Promise<void>;
    cancel(): void;
    private _getBrowser;
    private _newBrowser;
    private _lookAtNextRequest;
    private _launchNextBrowser;
}
