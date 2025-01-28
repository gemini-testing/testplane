import debug from "debug";
import { Pool } from "./types";
import { Config } from "../config";
import { Browser } from "../browser/browser";
export declare class PerBrowserLimitedPool implements Pool {
    log: debug.Debugger;
    private _browserPools;
    constructor(underlyingPool: Pool, config: Config);
    getBrowser(id: string, opts?: object): Promise<Browser>;
    freeBrowser(browser: Browser, opts?: object): Promise<void>;
    cancel(): void;
}
