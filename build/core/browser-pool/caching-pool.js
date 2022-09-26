"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("debug"));
const limited_use_set_1 = __importDefault(require("./limited-use-set"));
const utils_1 = require("./utils");
class CachingPool {
    constructor(underlyingPool, config, opts) {
        this.log = (0, debug_1.default)(`${opts.logNamespace}:pool:caching`);
        this.underlyingPool = underlyingPool;
        this._caches = {};
        this._config = config;
        this._logNamespace = opts.logNamespace;
    }
    _getCacheFor(id, version) {
        const compositeId = (0, utils_1.buildCompositeBrowserId)(id, version);
        this.log(`request for ${compositeId}`);
        if (!this._caches[compositeId]) {
            this.log(`init for ${compositeId}`);
            this._initPool(id, version);
        }
        return this._caches[compositeId];
    }
    async getBrowser(id, opts = {}) {
        const { version } = opts;
        const cache = this._getCacheFor(id, version);
        const browser = cache.pop();
        if (!browser) {
            this.log(`no cached browser for ${(0, utils_1.buildCompositeBrowserId)(id, version)}, requesting new`);
            return this.underlyingPool.getBrowser(id, opts);
        }
        this.log(`has cached browser ${browser.fullId}`);
        try {
            await browser.reset();
        }
        catch (e) {
            await this.underlyingPool.freeBrowser(browser);
            throw e;
        }
        return browser;
    }
    _initPool(browserId, version) {
        const compositeId = (0, utils_1.buildCompositeBrowserId)(browserId, version);
        const freeBrowser = this.underlyingPool.freeBrowser.bind(this.underlyingPool);
        const browserConfig = this._config.forBrowser(browserId);
        this._caches[compositeId] = new limited_use_set_1.default({
            formatItem: (item) => item.fullId,
            // browser does not get put in a set on first usages, so if
            // we want to limit it usage to N times, we must set N-1 limit
            // for the set.
            // @ts-expect-error
            useLimit: browserConfig.sessionUseLimit - 1,
            finalize: freeBrowser,
            logNamespace: this._logNamespace
        });
    }
    freeBrowser(browser, options = {}) {
        const shouldFreeForNextRequest = () => {
            const { compositeIdForNextRequest } = options;
            if (!compositeIdForNextRequest) {
                return false;
            }
            const { hasFreeSlots } = options;
            const hasCacheForNextRequest = this._caches[compositeIdForNextRequest];
            return !hasFreeSlots && !hasCacheForNextRequest;
        };
        const force = options.force || shouldFreeForNextRequest();
        this.log(`free ${browser.fullId} force=${force}`);
        if (force) {
            return this.underlyingPool.freeBrowser(browser);
        }
        const cache = this._getCacheFor(browser.id, browser.version);
        return cache.push(browser);
    }
    cancel() {
        this.log('cancel');
        this.underlyingPool.cancel();
    }
}
exports.default = CachingPool;
