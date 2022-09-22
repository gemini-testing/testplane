import debug from 'debug';
import _ from 'lodash';
import yallist from 'yallist';

import {buildCompositeBrowserId} from './utils';
import CancelledError from '../errors/cancelled-error';

import type {FreeBrowserOpts, GetBrowserOpts, Pool} from '../types/pool';
import type NewBrowser from '../../browser/new-browser';

type LimitedPoolOpts = {
    logNamespace: string;
    limit: number;
    isSpecificBrowserLimiter?: boolean;
};

type Request = {
    id: string;
    version?: string;
    resolve: (browser: NewBrowser) => void;
    reject: (err: any) => void;
};

export default class LimitedPool implements Pool {
    log: debug.Debugger;
    underlyingPool: Pool;
    private _limit: number;
    private _launched: number;
    private _requests: number;
    private _requestQueue: yallist<Request>;
    private _highPriorityRequestQueue: yallist<Request>;
    private _isSpecificBrowserLimiter: boolean;

    static create(underlyingPool: Pool, opts: LimitedPoolOpts): LimitedPool {
        return new LimitedPool(underlyingPool, opts);
    }

    constructor(underlyingPool: Pool, opts: LimitedPoolOpts) {
        this.log = debug(`${opts.logNamespace}:pool:limited`);

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

    async getBrowser(id: string, opts: GetBrowserOpts = {}): Promise<NewBrowser> {
        const optsToPrint = JSON.stringify(opts);

        this.log(`get browser ${id} with opts:${optsToPrint} (launched ${this._launched}, limit ${this._limit})`);

        ++this._requests;

        try {
            const browser = await this._getBrowser(id, opts);

            return browser;
        } catch (e) {
            --this._requests;

            throw e;
        }
    }

    async freeBrowser(browser: NewBrowser, opts: FreeBrowserOpts = {}): Promise<void> {
        --this._requests;

        const nextRequest = this._lookAtNextRequest();
        const compositeIdForNextRequest = nextRequest && buildCompositeBrowserId(nextRequest.id, nextRequest.version);
        const hasFreeSlots = this._launched < this._limit;
        const shouldFreeUnusedResource = this._isSpecificBrowserLimiter && this._launched > this._requests;
        const force = opts.force || shouldFreeUnusedResource;
        const optsForFree = {force, compositeIdForNextRequest, hasFreeSlots};

        this.log(`free browser ${browser.fullId} with opts:${JSON.stringify(optsForFree)}`);

        try {
            await this.underlyingPool.freeBrowser(browser, optsForFree);
        } finally {
            this._launchNextBrowser();
        }
    }

    cancel(): void {
        this.log('cancel');

        const reject_ = (entry: Request) => entry.reject(new CancelledError());
        this._highPriorityRequestQueue.forEach(reject_);
        this._requestQueue.forEach(reject_);

        this._highPriorityRequestQueue = yallist.create();
        this._requestQueue = yallist.create();

        this.underlyingPool.cancel();
    }

    private _getBrowser(id: string, opts: GetBrowserOpts = {}): Promise<NewBrowser> {
        if (this._launched < this._limit) {
            this.log('can launch one more');
            this._launched++;

            return this._newBrowser(id, opts);
        }

        this.log('queuing the request');

        const queue = opts.highPriority ? this._highPriorityRequestQueue : this._requestQueue;
        const {version} = opts;

        return new Promise((resolve, reject) => {
            queue.push({id, version, resolve, reject});
        });
    }

    private async _newBrowser(id: string, opts: any): Promise<NewBrowser> {
        this.log(`launching new browser ${id} with opts:${JSON.stringify(opts)}`);

        try {
            const browser = await this.underlyingPool.getBrowser(id, opts);

            return browser;
        } catch (e) {
            await this._launchNextBrowser();

            throw e;
        }
    }

    private _lookAtNextRequest(): Request | undefined {
        return this._highPriorityRequestQueue.get(0) || this._requestQueue.get(0);
    }

    private async _launchNextBrowser(): Promise<void> {
        const queued = this._highPriorityRequestQueue.shift() || this._requestQueue.shift();

        if (queued) {
            const compositeId = buildCompositeBrowserId(queued.id, queued.version);

            this.log(`has queued requests for ${compositeId}`);
            this.log(`remaining queue length: ${this._requestQueue.length}`);
            const browser = await this._newBrowser(queued.id, {version: queued.version});

            queued.resolve(browser);
        } else {
            this._launched--;
        }
    }
}
