import debug from "debug";
import _ from "lodash";
import yallist from "yallist";
import { AsyncLocalStorage } from "node:async_hooks";

import { BrowserOpts, Pool, PoolObserver, PoolObserverOperation } from "./types";
import { CancelledError } from "./cancelled-error";
import { buildCompositeBrowserId } from "./utils";
import { Browser } from "../browser/browser";
import { BrowserConfig } from "../config/browser-config";

export interface LimitedPoolOpts {
    limit: number;
    isSpecificBrowserLimiter?: boolean;
    observer?: PoolObserver;
}

interface QueueItem {
    browserConfig: BrowserConfig;
    runInContext: ReturnType<typeof AsyncLocalStorage.snapshot>;
    opts: {
        force?: boolean;
        version?: string;
    };
    resolve: (value: unknown) => void;
    reject: (value: unknown) => void;
    waitOperation?: PoolObserverOperation;
}

export class LimitedPool implements Pool {
    private _limit: number;
    private _launched: number;
    private _requests: number;
    private _requestQueue: yallist<QueueItem>;
    private _highPriorityRequestQueue: yallist<QueueItem>;
    private _isSpecificBrowserLimiter: boolean;
    private _observer?: PoolObserver;
    private _cancelError: Error | null = null;
    log: debug.Debugger;
    underlyingPool: Pool;

    static create(underlyingPool: Pool, opts: LimitedPoolOpts): LimitedPool {
        return new LimitedPool(underlyingPool, opts);
    }

    constructor(underlyingPool: Pool, opts: LimitedPoolOpts) {
        this.log = debug("testplane:pool:limited");

        this.underlyingPool = underlyingPool;
        this._limit = opts.limit;
        this._launched = 0;
        this._requests = 0;
        this._requestQueue = yallist.create();
        this._highPriorityRequestQueue = yallist.create();
        this._isSpecificBrowserLimiter = _.isBoolean(opts.isSpecificBrowserLimiter)
            ? opts.isSpecificBrowserLimiter
            : true;
        this._observer = opts.observer;
    }

    async getBrowser(browserConfig: BrowserConfig, opts: BrowserOpts = {}): Promise<Browser> {
        if (this._cancelError) throw this._cancelError;
        const { id } = browserConfig;
        const optsToPrint = JSON.stringify(opts);
        this.log(`get browser ${id} with opts:${optsToPrint} (launched ${this._launched}, limit ${this._limit})`);

        ++this._requests;
        this._sampleState(id);
        try {
            return await this._getBrowser(browserConfig, opts);
        } catch (e) {
            --this._requests;
            this._sampleState(id);
            return await Promise.reject(e);
        }
    }

    async freeBrowser(browser: Browser, opts: BrowserOpts = {}): Promise<void> {
        --this._requests;
        this._sampleState(browser.id);

        const nextRequest = this._lookAtNextRequest();
        const compositeIdForNextRequest =
            nextRequest && buildCompositeBrowserId(nextRequest.browserConfig.id, nextRequest.opts.version);
        const hasFreeSlots = this._launched < this._limit;
        const shouldFreeUnusedResource = this._isSpecificBrowserLimiter && this._launched > this._requests;
        const force = opts.force || shouldFreeUnusedResource;
        const optsForFree = { force, compositeIdForNextRequest, hasFreeSlots };

        this.log(`free browser ${browser.fullId} with opts:${JSON.stringify(optsForFree)}`);

        return this.underlyingPool
            .freeBrowser(browser, optsForFree)
            .finally(() => this._launchNextBrowser(browser.config));
    }

    cancel(error: Error = new CancelledError()): void {
        this.log("cancel");
        this._rejectRequests(error);
        this.underlyingPool.cancel(error);
    }

    private _rejectRequests(error: Error): void {
        this._cancelError ??= error;
        const reject_ = (entry: QueueItem): void => entry.reject(error);
        const interrupt_ = (entry: QueueItem): void => entry.waitOperation?.end("interrupted");
        this._highPriorityRequestQueue.forEach(interrupt_);
        this._requestQueue.forEach(interrupt_);
        this._highPriorityRequestQueue.forEach(reject_);
        this._requestQueue.forEach(reject_);

        this._highPriorityRequestQueue = yallist.create();
        this._requestQueue = yallist.create();
    }

    prewarm(browserConfigs: BrowserConfig[]): Promise<void> {
        return this.underlyingPool.prewarm(browserConfigs);
    }

    [Symbol.asyncDispose](): Promise<void> {
        this._rejectRequests(new CancelledError());
        return this.underlyingPool[Symbol.asyncDispose]();
    }

    private async _getBrowser(browserConfig: BrowserConfig, opts: BrowserOpts = {}): Promise<Browser> {
        const { id } = browserConfig;
        if (this._launched < this._limit) {
            this.log("can launch one more");
            this._launched++;
            this._sampleState(id);
            return this._newBrowser(browserConfig, opts);
        }

        this.log("queuing the request");

        const queue = opts.highPriority ? this._highPriorityRequestQueue : this._requestQueue;
        const limiter = this._limiterKind();
        const waitOperation = this._observer?.start("browser.pool.wait", {
            browserId: id,
            limiter,
            limit: this._limit,
            highPriority: Boolean(opts.highPriority),
        });

        return new Promise((resolve, reject) => {
            queue.push({
                browserConfig,
                runInContext: AsyncLocalStorage.snapshot(),
                opts,
                resolve: resolve as QueueItem["resolve"],
                reject: reject as QueueItem["resolve"],
                waitOperation,
            });
            this._sampleState(id);
        });
    }

    private async _newBrowser(browserConfig: BrowserConfig, opts: object): Promise<Browser> {
        this.log(`launching new browser ${browserConfig.id} with opts:${JSON.stringify(opts)}`);

        return this.underlyingPool.getBrowser(browserConfig, opts).catch(e => {
            this._launchNextBrowser(browserConfig);
            return Promise.reject(e);
        });
    }

    private _lookAtNextRequest(): QueueItem | undefined {
        return this._highPriorityRequestQueue.get(0) || this._requestQueue.get(0);
    }

    private _launchNextBrowser(browserConfig: BrowserConfig): void {
        const queued = this._highPriorityRequestQueue.shift() || this._requestQueue.shift();

        if (queued) {
            const compositeId = buildCompositeBrowserId(queued.browserConfig.id, queued.opts.version);

            this.log(`has queued requests for ${compositeId}`);
            this.log(`remaining queue length: ${this._requestQueue.length}`);

            queued.runInContext(() => {
                queued.waitOperation?.end();
                this._sampleState(queued.browserConfig.id);

                this._newBrowser(queued.browserConfig, queued.opts).then(queued.resolve, queued.reject);
            });
        } else {
            this._launched--;
            this._sampleState(browserConfig.id);
        }
    }

    private _limiterKind(): "browser" | "global" {
        return this._isSpecificBrowserLimiter ? "browser" : "global";
    }

    private _sampleState(browserId: string): void {
        const dimensions = { browserId, limiter: this._limiterKind() };
        this._observer?.record("queueDepth", {
            ...dimensions,
            limit: this._limit,
            value: this._highPriorityRequestQueue.length + this._requestQueue.length,
        });
        this._observer?.record("requestsActive", { ...dimensions, limit: this._limit, value: this._requests });
        this._observer?.record("sessionsLaunched", { ...dimensions, limit: this._limit, value: this._launched });
    }
}
