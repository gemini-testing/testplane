"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("debug"));
const lodash_1 = __importDefault(require("lodash"));
const yallist_1 = __importDefault(require("yallist"));
const utils_1 = require("./utils");
const cancelled_error_1 = __importDefault(require("../errors/cancelled-error"));
class LimitedPool {
    constructor(underlyingPool, opts) {
        this.log = (0, debug_1.default)(`${opts.logNamespace}:pool:limited`);
        this.underlyingPool = underlyingPool;
        this._limit = opts.limit;
        this._launched = 0;
        this._requests = 0;
        this._requestQueue = yallist_1.default.create();
        this._highPriorityRequestQueue = yallist_1.default.create();
        this._isSpecificBrowserLimiter = lodash_1.default.isBoolean(opts.isSpecificBrowserLimiter)
            ? opts.isSpecificBrowserLimiter
            : true;
    }
    static create(underlyingPool, opts) {
        return new LimitedPool(underlyingPool, opts);
    }
    async getBrowser(id, opts = {}) {
        const optsToPrint = JSON.stringify(opts);
        this.log(`get browser ${id} with opts:${optsToPrint} (launched ${this._launched}, limit ${this._limit})`);
        ++this._requests;
        try {
            const browser = await this._getBrowser(id, opts);
            return browser;
        }
        catch (e) {
            --this._requests;
            throw e;
        }
    }
    async freeBrowser(browser, opts = {}) {
        --this._requests;
        const nextRequest = this._lookAtNextRequest();
        const compositeIdForNextRequest = nextRequest && (0, utils_1.buildCompositeBrowserId)(nextRequest.id, nextRequest.version);
        const hasFreeSlots = this._launched < this._limit;
        const shouldFreeUnusedResource = this._isSpecificBrowserLimiter && this._launched > this._requests;
        const force = opts.force || shouldFreeUnusedResource;
        const optsForFree = { force, compositeIdForNextRequest, hasFreeSlots };
        this.log(`free browser ${browser.fullId} with opts:${JSON.stringify(optsForFree)}`);
        try {
            await this.underlyingPool.freeBrowser(browser, optsForFree);
        }
        finally {
            this._launchNextBrowser();
        }
    }
    cancel() {
        this.log('cancel');
        const reject_ = (entry) => entry.reject(new cancelled_error_1.default());
        this._highPriorityRequestQueue.forEach(reject_);
        this._requestQueue.forEach(reject_);
        this._highPriorityRequestQueue = yallist_1.default.create();
        this._requestQueue = yallist_1.default.create();
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
        const { version } = opts;
        return new Promise((resolve, reject) => {
            queue.push({ id, version, resolve, reject });
        });
    }
    async _newBrowser(id, opts) {
        this.log(`launching new browser ${id} with opts:${JSON.stringify(opts)}`);
        try {
            const browser = await this.underlyingPool.getBrowser(id, opts);
            return browser;
        }
        catch (e) {
            await this._launchNextBrowser();
            throw e;
        }
    }
    _lookAtNextRequest() {
        return this._highPriorityRequestQueue.get(0) || this._requestQueue.get(0);
    }
    async _launchNextBrowser() {
        const queued = this._highPriorityRequestQueue.shift() || this._requestQueue.shift();
        if (queued) {
            const compositeId = (0, utils_1.buildCompositeBrowserId)(queued.id, queued.version);
            this.log(`has queued requests for ${compositeId}`);
            this.log(`remaining queue length: ${this._requestQueue.length}`);
            const browser = await this._newBrowser(queued.id, { version: queued.version });
            queued.resolve(browser);
        }
        else {
            this._launched--;
        }
    }
}
exports.default = LimitedPool;
