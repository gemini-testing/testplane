"use strict";

const Promise = require("bluebird");
const LimitedUseSet = require("./limited-use-set");
const debug = require("debug");
const { buildCompositeBrowserId } = require("./utils");

module.exports = class CachingPool {
    /**
     * @constructor
     * @extends BasicPool
     * @param {BasicPool} underlyingPool
     */
    constructor(underlyingPool, config) {
        this.log = debug("testplane:pool:caching");
        this.underlyingPool = underlyingPool;
        this._caches = {};
        this._config = config;
    }

    _getCacheFor(id, version) {
        const compositeId = buildCompositeBrowserId(id, version);

        this.log(`request for ${compositeId}`);

        if (!this._caches[compositeId]) {
            this.log(`init for ${compositeId}`);
            this._initPool(id, version);
        }

        return this._caches[compositeId];
    }

    getBrowser(id, opts = {}) {
        const { version } = opts;
        const cache = this._getCacheFor(id, version);
        const browser = cache.pop();

        if (!browser) {
            this.log(`no cached browser for ${buildCompositeBrowserId(id, version)}, requesting new`);

            return this.underlyingPool.getBrowser(id, opts);
        }

        this.log(`has cached browser ${browser.fullId}`);

        return browser
            .reset()
            .catch(e => {
                const reject = Promise.reject.bind(null, e);
                return this.underlyingPool.freeBrowser(browser).then(reject, reject);
            })
            .then(() => browser);
    }

    _initPool(browserId, version) {
        const compositeId = buildCompositeBrowserId(browserId, version);
        const freeBrowser = this.underlyingPool.freeBrowser.bind(this.underlyingPool);
        const { testsPerSession } = this._config.forBrowser(browserId);

        this._caches[compositeId] = new LimitedUseSet({
            formatItem: item => item.fullId,
            // browser does not get put in a set on first usages, so if
            // we want to limit it usage to N times, we must set N-1 limit
            // for the set.
            useLimit: testsPerSession - 1,
            finalize: freeBrowser,
        });
    }

    /**
     * Free browser
     * @param {Browser} browser session instance
     * @param {Object} [options] - advanced options
     * @param {Boolean} [options.force] - if `true` than browser should
     * not be cached
     * @returns {Promise<undefined>}
     */
    freeBrowser(browser, options = {}) {
        const shouldFreeForNextRequest = () => {
            const { compositeIdForNextRequest } = options;

            if (!compositeIdForNextRequest) {
                return false;
            }

            const { hasFreeSlots } = options;
            const hasCacheForNextRequest = this._caches[options.compositeIdForNextRequest];

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
        this.log("cancel");
        this.underlyingPool.cancel();
    }
};
