"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LimitedPool = void 0;
const debug_1 = __importDefault(require("debug"));
const lodash_1 = __importDefault(require("lodash"));
const yallist_1 = __importDefault(require("yallist"));
const cancelled_error_1 = require("./cancelled-error");
const utils_1 = require("./utils");
class LimitedPool {
    static create(underlyingPool, opts) {
        return new LimitedPool(underlyingPool, opts);
    }
    constructor(underlyingPool, opts) {
        this.log = (0, debug_1.default)("testplane:pool:limited");
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
    async getBrowser(id, opts = {}) {
        const optsToPrint = JSON.stringify(opts);
        this.log(`get browser ${id} with opts:${optsToPrint} (launched ${this._launched}, limit ${this._limit})`);
        ++this._requests;
        try {
            return await this._getBrowser(id, opts);
        }
        catch (e) {
            --this._requests;
            return await Promise.reject(e);
        }
    }
    async freeBrowser(browser, opts = {}) {
        --this._requests;
        const nextRequest = this._lookAtNextRequest();
        const compositeIdForNextRequest = nextRequest && (0, utils_1.buildCompositeBrowserId)(nextRequest.id, nextRequest.opts.version);
        const hasFreeSlots = this._launched < this._limit;
        const shouldFreeUnusedResource = this._isSpecificBrowserLimiter && this._launched > this._requests;
        const force = opts.force || shouldFreeUnusedResource;
        const optsForFree = { force, compositeIdForNextRequest, hasFreeSlots };
        this.log(`free browser ${browser.fullId} with opts:${JSON.stringify(optsForFree)}`);
        return this.underlyingPool.freeBrowser(browser, optsForFree).finally(() => this._launchNextBrowser());
    }
    cancel() {
        this.log("cancel");
        const reject_ = (entry) => entry.reject(new cancelled_error_1.CancelledError());
        this._highPriorityRequestQueue.forEach(reject_);
        this._requestQueue.forEach(reject_);
        this._highPriorityRequestQueue = yallist_1.default.create();
        this._requestQueue = yallist_1.default.create();
        this.underlyingPool.cancel();
    }
    async _getBrowser(id, opts = {}) {
        if (this._launched < this._limit) {
            this.log("can launch one more");
            this._launched++;
            return this._newBrowser(id, opts);
        }
        this.log("queuing the request");
        const queue = opts.highPriority ? this._highPriorityRequestQueue : this._requestQueue;
        return new Promise((resolve, reject) => {
            queue.push({ id, opts, resolve: resolve, reject: reject });
        });
    }
    async _newBrowser(id, opts) {
        this.log(`launching new browser ${id} with opts:${JSON.stringify(opts)}`);
        return this.underlyingPool.getBrowser(id, opts).catch(e => {
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
            const compositeId = (0, utils_1.buildCompositeBrowserId)(queued.id, queued.opts.version);
            this.log(`has queued requests for ${compositeId}`);
            this.log(`remaining queue length: ${this._requestQueue.length}`);
            this._newBrowser(queued.id, queued.opts).then(queued.resolve, queued.reject);
        }
        else {
            this._launched--;
        }
    }
}
exports.LimitedPool = LimitedPool;
//# sourceMappingURL=limited-pool.js.map