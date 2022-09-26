import debug from 'debug';

import LimitedUseSet from './limited-use-set';
import {buildCompositeBrowserId} from './utils';

import type {FreeBrowserOpts, GetBrowserOpts, Pool} from '../types/pool';
import type NewBrowser from '../../browser/new-browser';
import type Config from '../../config';

type CachingPoolOpts = {
    logNamespace: string;
};

export default class CachingPool implements Pool {
    log: debug.Debugger;
    underlyingPool: Pool;
    private _caches: Record<string, LimitedUseSet<NewBrowser>>;
    private _config: Config;
    private _logNamespace: string;

    constructor(underlyingPool: Pool, config: Config, opts: CachingPoolOpts) {
        this.log = debug(`${opts.logNamespace}:pool:caching`);
        this.underlyingPool = underlyingPool;
        this._caches = {};
        this._config = config;
        this._logNamespace = opts.logNamespace;
    }

    private _getCacheFor(id: string, version?: string): LimitedUseSet<NewBrowser> {
        const compositeId = buildCompositeBrowserId(id, version);

        this.log(`request for ${compositeId}`);

        if (!this._caches[compositeId]) {
            this.log(`init for ${compositeId}`);
            this._initPool(id, version);
        }

        return this._caches[compositeId];
    }

    async getBrowser(id: string, opts: GetBrowserOpts = {}): Promise<NewBrowser> {
        const {version} = opts;
        const cache = this._getCacheFor(id, version);
        const browser = cache.pop();

        if (!browser) {
            this.log(`no cached browser for ${buildCompositeBrowserId(id, version)}, requesting new`);

            return this.underlyingPool.getBrowser(id, opts);
        }

        this.log(`has cached browser ${browser.fullId}`);

        try {
            await browser.reset();
        } catch (e: unknown) {
            await this.underlyingPool.freeBrowser(browser);

            throw e;
        }

        return browser;
    }

    private _initPool(browserId: string, version?: string): void {
        const compositeId = buildCompositeBrowserId(browserId, version);
        const freeBrowser = this.underlyingPool.freeBrowser.bind(this.underlyingPool);
        const browserConfig = this._config.forBrowser(browserId);

        this._caches[compositeId] = new LimitedUseSet({
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

    freeBrowser(browser: NewBrowser, options: FreeBrowserOpts = {}): Promise<void> {
        const shouldFreeForNextRequest = () => {
            const {compositeIdForNextRequest} = options;

            if (!compositeIdForNextRequest) {
                return false;
            }

            const {hasFreeSlots} = options;
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

    cancel(): void {
        this.log('cancel');
        this.underlyingPool.cancel();
    }
}
