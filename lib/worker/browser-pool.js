'use strict';

const _ = require('lodash');
const Browser = require('../browser');
const RunnerEvents = require('../constants/runner-events');

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
        this._browsers[browserId] || (this._browsers[browserId] = []);

        let browser = _.find(this._browsers[browserId], (browser) => !browser.publicAPI.requestHandler.sessionID);

        if (!browser) {
            browser = Browser.create(this._config, browserId);
            this._browsers[browserId].push(browser);

            this._emitter.emit(RunnerEvents.NEW_BROWSER, browser.publicAPI, {browserId});
        }

        browser.publicAPI.requestHandler.sessionID = sessionId;

        return browser;
    }

    freeBrowser(browser) {
        browser.publicAPI.requestHandler.sessionID = null;
    }
};
