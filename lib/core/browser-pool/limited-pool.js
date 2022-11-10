'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const yallist = require('yallist');
const Pool = require('./pool');
const CancelledError = require('../errors/cancelled-error');
const debug = require('debug');
const {buildCompositeBrowserId} = require('./utils');

module.exports = class LimitedPool extends Pool {
    static create(underlyingPool, opts) {
        return new LimitedPool(underlyingPool, opts);
    }

    /**
     * @extends BasicPool
     * @param {Number} limit
     * @param {BasicPool} underlyingPool
     */
    constructor(underlyingPool, opts) {
        super();

        this.log = debug('hermione:pool:limited');

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

    getBrowser(id, opts = {}) {
        const optsToPrint = JSON.stringify(opts);
        this.log(`get browser ${id} with opts:${optsToPrint} (launched ${this._launched}, limit ${this._limit})`);

        ++this._requests;
        return this._getBrowser(id, opts)
            .catch((e) => {
                --this._requests;
                return Promise.reject(e);
            });
    }

    freeBrowser(browser, opts = {}) {
        --this._requests;

        const nextRequest = this._lookAtNextRequest();
        const compositeIdForNextRequest = nextRequest && buildCompositeBrowserId(nextRequest.id, nextRequest.version);
        const hasFreeSlots = this._launched < this._limit;
        const shouldFreeUnusedResource = this._isSpecificBrowserLimiter && this._launched > this._requests;
        const force = opts.force || shouldFreeUnusedResource;
        const optsForFree = {force, compositeIdForNextRequest, hasFreeSlots};

        this.log(`free browser ${browser.fullId} with opts:${JSON.stringify(optsForFree)}`);

        return this.underlyingPool
            .freeBrowser(browser, optsForFree)
            .finally(() => this._launchNextBrowser());
    }

    cancel() {
        this.log('cancel');

        const reject_ = (entry) => entry.reject(new CancelledError());
        this._highPriorityRequestQueue.forEach(reject_);
        this._requestQueue.forEach(reject_);

        this._highPriorityRequestQueue = yallist.create();
        this._requestQueue = yallist.create();

        this.underlyingPool.cancel();
    }

    _getBrowser(id, opts = {}) {
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

    /**
     * @param {String} id
     * @returns {Promise<Browser>}
     */
    _newBrowser(id, opts) {
        this.log(`launching new browser ${id} with opts:${JSON.stringify(opts)}`);

        return this.underlyingPool.getBrowser(id, opts)
            .catch((e) => {
                this._launchNextBrowser();
                return Promise.reject(e);
            });
    }

    _lookAtNextRequest() {
        return this._highPriorityRequestQueue.get(0) || this._requestQueue.get(0);
    }

    _launchNextBrowser() {
        const queued = this._highPriorityRequestQueue.shift() || this._requestQueue.shift();

        if (queued) {
            const compositeId = buildCompositeBrowserId(queued.id, queued.version);

            this.log(`has queued requests for ${compositeId}`);
            this.log(`remaining queue length: ${this._requestQueue.length}`);
            this._newBrowser(queued.id, {version: queued.version})
                .then(queued.resolve, queued.reject);
        } else {
            this._launched--;
        }
    }
};
