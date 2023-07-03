"use strict";

const _ = require("lodash");
const Browser = require("../../browser/existing-browser");
const Calibrator = require("../../browser/calibrator");
const { WorkerEvents } = require("../../events");
const ipc = require("../../utils/ipc");
const { DEVTOOLS_PROTOCOL } = require("../../constants/config");

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

    async getBrowser({ browserId, browserVersion, sessionId, sessionCaps, sessionOpts }) {
        this._browsers[browserId] = this._browsers[browserId] || [];

        let browser = _.find(this._browsers[browserId], browser => {
            return browserVersion
                ? _.isNil(browser.sessionId) && browser.version === browserVersion
                : _.isNil(browser.sessionId);
        });

        try {
            browser = Browser.create(this._config, browserId, browserVersion, this._emitter);
            await browser.init({ sessionId, sessionCaps, sessionOpts }, this._calibrator);

            this._emitter.emit(WorkerEvents.NEW_BROWSER, browser.publicAPI, { browserId: browser.id, browserVersion });

            return browser;
        } catch (error) {
            if (!browser) {
                throw error;
            }

            browser.sessionId = sessionId;
            browser.markAsBroken();
            this.freeBrowser(browser);

            throw Object.assign(error, { meta: browser.meta });
        }
    }

    freeBrowser(browser) {
        ipc.emit(`worker.${browser.sessionId}.freeBrowser`, browser.state);

        if (browser.state.isBroken) {
            _.pull(this._browsers[browser.id], browser);
        }

        browser.quit();
    }
};
