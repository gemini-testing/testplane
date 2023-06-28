export = PerBrowserLimitedPool;
declare class PerBrowserLimitedPool extends Pool {
    constructor(underlyingPool: any, config: any);
    log: any;
    _browserPools: _.Dictionary<any>;
    getBrowser(id: any, opts: any): any;
    freeBrowser(browser: any, opts: any): any;
}
import Pool = require("./pool");
import _ = require("lodash");
