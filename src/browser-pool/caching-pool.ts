import debug from "debug";

import { LimitedUseSet } from "./limited-use-set";
import { buildCompositeBrowserId } from "./utils";
import { BasicPool } from "./basic-pool";
import { BrowserOpts, Pool, PoolObserver } from "./types";
import { NewBrowser } from "../browser/new-browser";
import { CancelledError } from "./cancelled-error";
import { BrowserConfig } from "../config/browser-config";

export type FreeBrowserOpts = { hasFreeSlots?: boolean; force?: boolean; compositeIdForNextRequest?: string };

interface BrowserCache {
    browserId: string;
    sessions: LimitedUseSet<NewBrowser>;
}

export class CachingPool implements Pool {
    private _caches: Record<string, BrowserCache>;
    private _sessionCount = 0;
    private readonly _sessionsByBrowser = new Map<string, number>();
    private readonly _pendingCloses = new Map<NewBrowser, Promise<void>>();
    private _closeError?: unknown;
    private _observer?: PoolObserver;
    private _closed = false;
    private _cancelError: Error | null = null;
    underlyingPool: BasicPool;
    log: debug.Debugger;

    constructor(
        underlyingPool: BasicPool,
        observer?: PoolObserver,
        private readonly _parallelLimit = Infinity,
    ) {
        this.log = debug("testplane:pool:caching");
        this.underlyingPool = underlyingPool;
        this._caches = {};
        this._observer = isPoolObserver(observer) ? observer : undefined;
    }

    private _getCacheFor(browserConfig: BrowserConfig, version?: string): LimitedUseSet<NewBrowser> {
        const compositeId = buildCompositeBrowserId(browserConfig.id, version);

        this.log(`request for ${compositeId}`);

        if (!this._caches[compositeId]) {
            this.log(`init for ${compositeId}`);
            this._initPool(browserConfig, version);
        }

        return this._caches[compositeId].sessions;
    }

    async getBrowser(browserConfig: BrowserConfig, opts: BrowserOpts = {}): Promise<NewBrowser> {
        const { id, sessionsPerBrowser } = browserConfig;

        while (!this._closed) {
            const browser = this._getCacheFor(browserConfig, opts.version).pop();
            if (browser) {
                return this._reuseBrowser(browser);
            }

            if (this._parallelLimit === Infinity) {
                return this.underlyingPool.getBrowser(browserConfig, opts);
            }

            const atProfileLimit = (this._sessionsByBrowser.get(id) ?? 0) >= sessionsPerBrowser;
            if (!atProfileLimit && this._sessionCount < this._parallelLimit) {
                return this._openBrowser(browserConfig, opts);
            }

            const idleBrowser = this._takeIdleBrowser(atProfileLimit ? id : undefined);
            if (idleBrowser) {
                await this._closeBrowser(idleBrowser);
            } else if (this._pendingCloses.size) {
                await Promise.race(this._pendingCloses.values()).catch(() => undefined);
            } else {
                // The outer limiters leave room for this request, unless a failed quit still occupies a slot.
                throw this._closeError ?? new Error("No browser session slot could be reclaimed");
            }
        }

        throw this._cancelError ?? new CancelledError();
    }

    private async _reuseBrowser(browser: NewBrowser): Promise<NewBrowser> {
        const browserId = browser.id;
        this.log(`has cached browser ${browser.fullId}`);

        this._observer?.record("sessionReused", { browserId });
        const resetOperation = this._observer?.start("browser.session.reset", { browserId, reused: true });

        try {
            await browser.reset();
            if (this._closed) throw this._cancelError ?? new CancelledError();
            resetOperation?.end();
            return browser;
        } catch (error) {
            resetOperation?.end("failed");
            await this._closeBrowser(browser).catch(() => undefined);
            throw error;
        }
    }

    private async _openBrowser(browserConfig: BrowserConfig, opts: BrowserOpts): Promise<NewBrowser> {
        const { id } = browserConfig;
        this._changeSessionCount(id, 1);
        try {
            return await this.underlyingPool.getBrowser(browserConfig, opts);
        } catch (error) {
            this._changeSessionCount(id, -1);
            throw error;
        }
    }

    private _changeSessionCount(browserId: string, delta: number): void {
        this._sessionCount += delta;
        this._sessionsByBrowser.set(browserId, (this._sessionsByBrowser.get(browserId) ?? 0) + delta);
    }

    private _takeIdleBrowser(browserId?: string): NewBrowser | undefined {
        for (const cache of Object.values(this._caches)) {
            if (browserId !== undefined && browserId !== cache.browserId) {
                continue;
            }

            const browser = cache.sessions.take();
            if (browser) {
                return browser;
            }
        }
        return undefined;
    }

    private _closeBrowser(browser: NewBrowser): Promise<void> {
        if (this._parallelLimit === Infinity || this._closed) {
            return this.underlyingPool.freeBrowser(browser);
        }

        const pending = this._pendingCloses.get(browser);
        if (pending) {
            return pending;
        }

        const closing = this.underlyingPool
            .freeBrowser(browser)
            .then(() => this._changeSessionCount(browser.id, -1))
            .catch(error => {
                // A failed quit may still occupy a grid slot.
                this._closeError = error;
                throw error;
            })
            .finally(() => this._pendingCloses.delete(browser));
        this._pendingCloses.set(browser, closing);
        return closing;
    }

    private _initPool(browserConfig: BrowserConfig, version?: string): void {
        const compositeId = buildCompositeBrowserId(browserConfig.id, version);
        const { testsPerSession } = browserConfig;

        const sessions = new LimitedUseSet<NewBrowser>({
            formatItem: (item): string => item.fullId,
            // browser does not get put in a set on first usages, so if
            // we want to limit it usage to N times, we must set N-1 limit
            // for the set.
            useLimit: testsPerSession - 1,
            finalize: browser => this._closeBrowser(browser),
        });
        this._caches[compositeId] = { browserId: browserConfig.id, sessions };
    }

    /**
     * Free browser
     * @param {Browser} browser session instance
     * @param {Object} [options] - advanced options
     * @param {Boolean} [options.force] - if `true` than browser should
     * not be cached
     * @returns {Promise<undefined>}
     */
    async freeBrowser(browser: NewBrowser, options: FreeBrowserOpts = {}): Promise<void> {
        const shouldFreeForNextRequest = (): boolean => {
            const { compositeIdForNextRequest } = options;

            if (!compositeIdForNextRequest) {
                return false;
            }

            const { hasFreeSlots } = options;
            const hasCacheForNextRequest = this._caches[options.compositeIdForNextRequest!];

            return !hasFreeSlots && !hasCacheForNextRequest;
        };
        const force = this._closed || options.force || (this._parallelLimit === Infinity && shouldFreeForNextRequest());

        this.log(`free ${browser.fullId} force=${force}`);

        if (force) {
            this._observer?.record("sessionFreed", { browserId: browser.id, cached: false });
            return this._closeBrowser(browser);
        }

        const cache = this._getCacheFor(browser.config, browser.version);

        this._observer?.record("sessionFreed", { browserId: browser.id, cached: true });
        return cache.push(browser);
    }

    cancel(err?: Error): void {
        this.log("cancel");
        this._closed = true;
        this._cancelError = err ?? new CancelledError();
        this._caches = {};
        this.underlyingPool.cancel(err);
    }

    prewarm(browserConfigs: BrowserConfig[]): Promise<void> {
        return this.underlyingPool.prewarm(browserConfigs);
    }

    [Symbol.asyncDispose](): Promise<void> {
        this._closed = true;
        // Cached sessions remain owned by BasicPool until they are actually closed.
        this._caches = {};
        return this.underlyingPool[Symbol.asyncDispose]();
    }
}

function isPoolObserver(value?: PoolObserver): value is PoolObserver {
    return typeof value?.start === "function" && typeof value.record === "function";
}
