'use strict';

const {Calibrator} = require('gemini-core');
const _ = require('lodash');
const Browser = require('../browser/existing-browser');
const RunnerEvents = require('./constants/runner-events');

module.exports = class BrowserPool {
    static create(config, emitter) {
        return new BrowserPool(config, emitter);
    }

    constructor(config, emitter) {
        this._config = config;
        this._emitter = emitter;

        this._browsers = {};

        this._calibrator = new Calibrator();
    }

    getBrowser(browserId, sessionId) {
        this._browsers[browserId] = this._browsers[browserId] || [];

        let browser = _.find(this._browsers[browserId], (browser) => !browser.sessionId);

        if (browser) {
            return browser.attach(sessionId);
        }

        browser = Browser.create(this._config, browserId);
        this._browsers[browserId].push(browser);

        return browser.init(sessionId, this._calibrator)
            .then(() => this._emitter.emit(RunnerEvents.NEW_BROWSER, browser.publicAPI, {browserId: browser.id}))
            .then(() => browser);
    }

    freeBrowser(browser) {
        browser.quit();
    }
};
