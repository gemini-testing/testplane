"use strict";

import _ from "lodash";
import yallist from "yallist";
import Pool from "./pool";
import { CancelledError } from "./cancelled-error";
import debug from "debug";
import { buildCompositeBrowserId } from "./utils";
import Browser from "../browser/browser";

export type LimitedPoolOpts = {
    limit: number;
    isSpecificBrowserLimiter?: boolean;
};

export type BrowserOpts = {
    force?: boolean;
    version?: string;
    highPriority?: boolean;
};

export type QueueItem = {
    id: string;
    opts: {
        force?: boolean;
        version?: string;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolve: (value: any) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reject: (value: any) => void;
};

class LimitedPool implements Pool {
    log: debug.Debugger;
    underlyingPool: Pool;
    _limit: number;
    _launched: number;
    _requests: number;
    _requestQueue: yallist<QueueItem>;
    _highPriorityRequestQueue: yallist<QueueItem>;
    _isSpecificBrowserLimiter: boolean;

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
    }

    async getBrowser(id: string, opts = {}): Promise<Browser> {
        const optsToPrint = JSON.stringify(opts);
        this.log(`get browser ${id} with opts:${optsToPrint} (launched ${this._launched}, limit ${this._limit})`);

        ++this._requests;
        try {
            return await this._getBrowser(id, opts);
        } catch (e) {
            --this._requests;
            return await Promise.reject(e);
        }
    }

    freeBrowser(browser: Browser, opts: BrowserOpts = {}): Promise<void> {
        --this._requests;

        const nextRequest = this._lookAtNextRequest();
        const compositeIdForNextRequest =
            nextRequest && buildCompositeBrowserId(nextRequest.id, nextRequest.opts.version);
        const hasFreeSlots = this._launched < this._limit;
        const shouldFreeUnusedResource = this._isSpecificBrowserLimiter && this._launched > this._requests;
        const force = opts.force || shouldFreeUnusedResource;
        const optsForFree = { force, compositeIdForNextRequest, hasFreeSlots };

        this.log(`free browser ${browser.fullId} with opts:${JSON.stringify(optsForFree)}`);

        return this.underlyingPool.freeBrowser(browser, optsForFree).finally(() => this._launchNextBrowser());
    }

    cancel(): void {
        this.log("cancel");

        const reject_ = (entry: QueueItem): void => entry.reject(new CancelledError());
        this._highPriorityRequestQueue.forEach(reject_);
        this._requestQueue.forEach(reject_);

        this._highPriorityRequestQueue = yallist.create();
        this._requestQueue = yallist.create();

        this.underlyingPool.cancel();
    }

    _getBrowser(id: string, opts: BrowserOpts = {}): Promise<Browser> {
        if (this._launched < this._limit) {
            this.log("can launch one more");
            this._launched++;
            return this._newBrowser(id, opts);
        }

        this.log("queuing the request");

        const queue = opts.highPriority ? this._highPriorityRequestQueue : this._requestQueue;

        return new Promise((resolve, reject) => {
            queue.push({ id, opts, resolve, reject });
        });
    }

    _newBrowser(id: string, opts: object): Promise<Browser> {
        this.log(`launching new browser ${id} with opts:${JSON.stringify(opts)}`);

        return this.underlyingPool.getBrowser(id, opts).catch(e => {
            this._launchNextBrowser();
            return Promise.reject(e);
        });
    }

    _lookAtNextRequest(): QueueItem | undefined {
        return this._highPriorityRequestQueue.get(0) || this._requestQueue.get(0);
    }

    _launchNextBrowser(): void {
        const queued = this._highPriorityRequestQueue.shift() || this._requestQueue.shift();

        if (queued) {
            const compositeId = buildCompositeBrowserId(queued.id, queued.opts.version);

            this.log(`has queued requests for ${compositeId}`);
            this.log(`remaining queue length: ${this._requestQueue.length}`);

            this._newBrowser(queued.id, queued.opts).then(queued.resolve, queued.reject);
        } else {
            this._launched--;
        }
    }
}

export default LimitedPool;
