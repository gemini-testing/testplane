"use strict";

import LimitedUseSet from "./limited-use-set";
import debug from "debug";
import { buildCompositeBrowserId } from "./utils";
import BasicPool from "./basic-pool";
import { Config } from "../config";
import Pool from "./pool";
import NewBrowser from "../browser/new-browser";

export type FreeBrowserOpts = { hasFreeSlots?: boolean; force?: boolean; compositeIdForNextRequest?: string };

class CachingPool implements Pool {
    underlyingPool: BasicPool;
    _caches: Record<string, LimitedUseSet<NewBrowser>>;
    log: debug.Debugger;
    _config: Config;
    constructor(underlyingPool: BasicPool, config: Config) {
        this.log = debug("testplane:pool:caching");
        this.underlyingPool = underlyingPool;
        this._caches = {};
        this._config = config;
    }

    _getCacheFor(id: string, version?: string): LimitedUseSet<NewBrowser> {
        const compositeId = buildCompositeBrowserId(id, version);

        this.log(`request for ${compositeId}`);

        if (!this._caches[compositeId]) {
            this.log(`init for ${compositeId}`);
            this._initPool(id, version);
        }

        return this._caches[compositeId];
    }

    getBrowser(id: string, opts: { version?: string } = {}): Promise<NewBrowser> {
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
                return this.underlyingPool.freeBrowser(browser).then(
                    () => Promise.reject(e),
                    () => Promise.reject(e),
                );
            })
            .then(() => browser);
    }

    _initPool(browserId: string, version?: string): void {
        const compositeId = buildCompositeBrowserId(browserId, version);
        const freeBrowser = this.underlyingPool.freeBrowser.bind(this.underlyingPool);
        const { testsPerSession } = this._config.forBrowser(browserId);

        this._caches[compositeId] = new LimitedUseSet<NewBrowser>({
            formatItem: (item): string => item.fullId,
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
    freeBrowser(browser: NewBrowser, options: FreeBrowserOpts = {}): Promise<void> {
        const shouldFreeForNextRequest = (): boolean => {
            const { compositeIdForNextRequest } = options;

            if (!compositeIdForNextRequest) {
                return false;
            }

            const { hasFreeSlots } = options;
            const hasCacheForNextRequest = this._caches[options.compositeIdForNextRequest!];

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

    cancel(): void {
        this.log("cancel");
        this.underlyingPool.cancel();
    }
}

export default CachingPool;
