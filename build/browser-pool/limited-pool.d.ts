export = LimitedPool;
declare class LimitedPool extends Pool {
    static create(underlyingPool: any, opts: any): import("./limited-pool");
    /**
     * @extends BasicPool
     * @param {Number} limit
     * @param {BasicPool} underlyingPool
     */
    constructor(underlyingPool: BasicPool, opts: any);
    log: any;
    underlyingPool: BasicPool;
    _limit: any;
    _launched: number;
    _requests: number;
    _requestQueue: any;
    _highPriorityRequestQueue: any;
    _isSpecificBrowserLimiter: any;
    getBrowser(id: any, opts?: {}): Promise<any>;
    freeBrowser(browser: any, opts?: {}): any;
    _getBrowser(id: any, opts?: {}): Promise<any>;
    /**
     * @param {String} id
     * @returns {Promise<Browser>}
     */
    _newBrowser(id: string, opts: any): Promise<Browser>;
    _lookAtNextRequest(): any;
    _launchNextBrowser(): void;
}
import Pool = require("./pool");
import Promise = require("bluebird");
