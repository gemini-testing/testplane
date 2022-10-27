'use strict';

const Browser = require('../../../browser/existing-browser');
const Calibrator = require('../../../core/calibrator');
const RunnerEvents = require('../../constants/runner-events');
const ipc = require('../../../utils/ipc');
const Pool = require('./pool');

module.exports = class BasicPool extends Pool {
    static create(...args) {
        return new this(...args);
    }

    constructor(config, emitter) {
        super();

        this._config = config;
        this._emitter = emitter;
        this._calibrator = new Calibrator();
    }

    async getBrowser({browserId, browserVersion, sessionId, sessionCaps, sessionOpts}) {
        let browser;

        try {
            browser = Browser.create(this._config, browserId, browserVersion, this._emitter);
            await browser.init({sessionId, sessionCaps, sessionOpts}, this._calibrator);

            this._emitter.emit(RunnerEvents.NEW_BROWSER, browser.publicAPI, {browserId: browser.id, browserVersion});

            return browser;
        } catch (error) {
            this._handleError(error, browser, sessionId);
        }
    }

    freeBrowser(browser) {
        ipc.emit(`worker.${browser.sessionId}.freeBrowser`, browser.state);

        browser.quit();
    }

    _handleError(error, browser, sessionId) {
        if (!browser) {
            throw error;
        }

        browser.sessionId = sessionId;
        browser.markAsBroken();
        this.freeBrowser(browser);

        throw Object.assign(error, {meta: browser.meta});
    }
};
