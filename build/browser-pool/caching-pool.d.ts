export = CachingPool;
declare class CachingPool extends Pool {
    /**
     * @constructor
     * @extends BasicPool
     * @param {BasicPool} underlyingPool
     */
    constructor(underlyingPool: BasicPool, config: any);
    log: any;
    underlyingPool: BasicPool;
    _caches: {};
    _config: any;
    _getCacheFor(id: any, version: any): any;
    getBrowser(id: any, opts?: {}): any;
    _initPool(browserId: any, version: any): void;
    /**
     * Free browser
     * @param {Browser} browser session instance
     * @param {Object} [options] - advanced options
     * @param {Boolean} [options.force] - if `true` than browser should
     * not be cached
     * @returns {Promise<undefined>}
     */
    freeBrowser(browser: Browser, options?: {
        force?: boolean | undefined;
    } | undefined): Promise<undefined>;
}
import Pool = require("./pool");
