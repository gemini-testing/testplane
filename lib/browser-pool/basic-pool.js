'use strict';

// const Promise = require('bluebird');
const _ = require('lodash');
const Browser = require('../browser');
// const CancelledError = require('../errors/cancelled-error');
const Events = require('../constants/runner-events');
const Pool = require('./pool');
const log = require('debug')('hermione:pool:basic');

module.exports = class BasicPool extends Pool {
    static create(config, emitter) {
        return new BasicPool(config, emitter);
    }

    /**
     * @constructor
     * @extends Pool
     * @param {Config} config
     */
    constructor(config, emitter) {
        super();

        this._config = config;
        this._emitter = emitter;

        this._activeSessions = {};
    }

    getBrowser(id) {
        const browser = Browser.create(this._config, id);

        return browser.init()
            .then(() => {
                log(`browser ${id} started`);
                return this._emit(Events.SESSION_START, browser);
            })
            .then(() => {
                if (this._cancelled) {
                    // return Promise.reject(new CancelledError());
                    return Promise.reject('Cancelled Error');
                }

                this._activeSessions[browser.sessionId] = browser;
            })
            // .then(() => browser.reset())
            .then(() => browser)
            .catch((e) => this.freeBrowser(browser).then(() => Promise.reject(e)));
    }

    _emit(event, browser) {
        return this._emitter.emitAndWait(event, browser.publicAPI, {browserId: browser.id})
            .catch((err) => log.warn(err && err.stack || err));
    }

    freeBrowser(browser) {
        delete this._activeSessions[browser.sessionId];
        log(`stop browser ${browser}`);

        return this._emit(Events.SESSION_END, browser)
            .catch((err) => console.warn(err && err.stack || err))
            .then(() => browser.quit());
    }

    cancel() {
        this._cancelled = true;

        _.forEach(this._activeSessions, (browser) => browser.quit());

        this._activeSessions = {};
    }
};
