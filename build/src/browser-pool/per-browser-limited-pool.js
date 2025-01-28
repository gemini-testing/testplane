"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerBrowserLimitedPool = void 0;
const debug_1 = __importDefault(require("debug"));
const lodash_1 = require("lodash");
const limited_pool_1 = require("./limited-pool");
class PerBrowserLimitedPool {
    constructor(underlyingPool, config) {
        this.log = (0, debug_1.default)("testplane:pool:per-browser-limited");
        const ids = config.getBrowserIds();
        this._browserPools = (0, lodash_1.zipObject)(ids, ids.map(id => limited_pool_1.LimitedPool.create(underlyingPool, {
            limit: config.forBrowser(id).sessionsPerBrowser,
        })));
    }
    getBrowser(id, opts) {
        this.log(`request ${id} with opts: ${JSON.stringify(opts)}`);
        return this._browserPools[id].getBrowser(id, opts);
    }
    freeBrowser(browser, opts) {
        this.log(`free ${browser.fullId}`);
        return this._browserPools[browser.id].freeBrowser(browser, opts);
    }
    cancel() {
        this.log("cancel");
        (0, lodash_1.forEach)(this._browserPools, pool => pool.cancel());
    }
}
exports.PerBrowserLimitedPool = PerBrowserLimitedPool;
//# sourceMappingURL=per-browser-limited-pool.js.map