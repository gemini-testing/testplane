'use strict';

const _ = require('lodash');
const Browser = require('../browser');
const RunnerEvents = require('./constants/runner-events');
const logger = require('../utils').logger;

module.exports = class BrowserPool {
    static create(config, emitter) {
        return new BrowserPool(config, emitter);
    }

    constructor(config, emitter) {
        this._config = config;
        this._emitter = emitter;

        this._browsers = {};
    }

    getBrowser(browserId, sessionId) {
        this._browsers[browserId] = this._browsers[browserId] || [];

        let browser = _.find(this._browsers[browserId], (browser) => !browser.sessionId);

        if (!browser) {
            browser = Browser.create(this._config, browserId);
            this._browsers[browserId].push(browser);

            try {
                this._initBrowser(browser);
            } catch (e) {
                logger.warn(`WARN: couldn't intialize browser ${browserId}\n`, e.stack);
            }
        }

        browser.sessionId = sessionId;
        browser.updateChanges({currentWindowSize: null});

        return browser;
    }

    _initBrowser(browser) {
        const config = this._config.forBrowser(browser.id);
        if (config.prepareBrowser) {
            config.prepareBrowser(browser.publicAPI);
        }

        this._emitter.emit(RunnerEvents.NEW_BROWSER, browser.publicAPI, {browserId: browser.id});
    }

    freeBrowser(browser) {
        browser.sessionId = null;
    }
};
