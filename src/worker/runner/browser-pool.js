"use strict";

const Browser = require("../../browser/existing-browser");
const Calibrator = require("../../browser/calibrator");
const RunnerEvents = require("../constants/runner-events");
const ipc = require("../../utils/ipc");

module.exports = class BrowserPool {
    static create(config, emitter) {
        return new BrowserPool(config, emitter);
    }

    constructor(config, emitter) {
        this._config = config;
        this._emitter = emitter;
        this._calibrator = new Calibrator();
    }

    async getBrowser({ browserId, browserVersion, sessionId, sessionCaps, sessionOpts, testXReqId }) {
        const browser = Browser.create(this._config, {
            id: browserId,
            version: browserVersion,
            testXReqId,
            emitter: this._emitter,
        });

        try {
            await browser.init({ sessionId, sessionCaps, sessionOpts }, this._calibrator);

            this._emitter.emit(RunnerEvents.NEW_BROWSER, browser.publicAPI, { browserId: browser.id, browserVersion });

            return browser;
        } catch (error) {
            if (!browser) {
                throw error;
            }

            browser.markAsBroken();
            this.freeBrowser(browser);

            throw Object.assign(error, { meta: browser.meta });
        }
    }

    freeBrowser(browser) {
        ipc.emit(`worker.${browser.sessionId}.freeBrowser`, browser.state);

        browser.quit();
    }
};
