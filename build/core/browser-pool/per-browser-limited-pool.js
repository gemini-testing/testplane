"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("debug"));
const lodash_1 = __importDefault(require("lodash"));
const limited_pool_1 = __importDefault(require("./limited-pool"));
class PerBrowserLimitedPool {
    constructor(underlyingPool, config, opts) {
        this.log = (0, debug_1.default)(`${opts.logNamespace}:pool:per-browser-limited`);
        const ids = config.getBrowserIds();
        this._browserPools = lodash_1.default.zipObject(ids, ids.map((id) => limited_pool_1.default.create(underlyingPool, {
            // @ts-expect-error
            limit: config.forBrowser(id).parallelLimit,
            logNamespace: opts.logNamespace
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
        this.log('cancel');
        lodash_1.default.forEach(this._browserPools, (pool) => pool.cancel());
    }
}
exports.default = PerBrowserLimitedPool;
