'use strict';
const _ = require('lodash');
const Promise = require('bluebird');
const CancelledError = require('../errors/cancelled-error');
const Pool = require('./pool');
const debug = require('debug');
module.exports = class BasicPool extends Pool {
    static create(BrowserManager, opts) {
        return new BasicPool(BrowserManager, opts);
    }
    constructor(BrowserManager, opts) {
        super();
        this._browserMgr = BrowserManager;
        this.log = debug(`${opts.logNamespace}:pool:basic`);
        this._activeSessions = {};
    }
    getBrowser(id, opts = {}) {
        const { version } = opts;
        const browser = this._browserMgr.create(id, version);
        return this._browserMgr.start(browser)
            .then(() => this.log(`browser ${browser.fullId} started`))
            .then(() => this._browserMgr.onStart(browser))
            .then(() => {
            if (this._cancelled) {
                return Promise.reject(new CancelledError());
            }
            this._activeSessions[browser.sessionId] = browser;
        })
            .then(() => browser.reset())
            .then(() => browser)
            .catch(async (e) => {
            if (browser.publicAPI) {
                await this.freeBrowser(browser);
            }
            return Promise.reject(e);
        });
    }
    freeBrowser(browser) {
        delete this._activeSessions[browser.sessionId];
        this.log(`stop browser ${browser.fullId}`);
        return this._browserMgr.onQuit(browser)
            .catch((err) => console.warn(err && err.stack || err))
            .then(() => this._browserMgr.quit(browser));
    }
    cancel() {
        this._cancelled = true;
        _.forEach(this._activeSessions, (browser) => this._browserMgr.quit(browser));
        this._activeSessions = {};
    }
};
