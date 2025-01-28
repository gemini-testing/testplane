import debug from "debug";
import { BasicPool } from "./basic-pool";
import { Config } from "../config";
import { Pool } from "./types";
import { NewBrowser } from "../browser/new-browser";
export type FreeBrowserOpts = {
    hasFreeSlots?: boolean;
    force?: boolean;
    compositeIdForNextRequest?: string;
};
export declare class CachingPool implements Pool {
    private _caches;
    private _config;
    underlyingPool: BasicPool;
    log: debug.Debugger;
    constructor(underlyingPool: BasicPool, config: Config);
    private _getCacheFor;
    getBrowser(id: string, opts?: {
        version?: string;
    }): Promise<NewBrowser>;
    private _initPool;
    /**
     * Free browser
     * @param {Browser} browser session instance
     * @param {Object} [options] - advanced options
     * @param {Boolean} [options.force] - if `true` than browser should
     * not be cached
     * @returns {Promise<undefined>}
     */
    freeBrowser(browser: NewBrowser, options?: FreeBrowserOpts): Promise<void>;
    cancel(): void;
}
