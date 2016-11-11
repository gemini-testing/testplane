'use strict';

const QEmitter = require('qemitter');

const RunnerEvents = require('./constants/runner-events');
const logger = require('./utils').logger;

module.exports = class BrowserAgent extends QEmitter {
    static create(browserId, pool) {
        return new BrowserAgent(browserId, pool);
    }

    constructor(browserId, pool) {
        super();

        this.browserId = browserId;

        this._pool = pool;
    }

    getBrowser() {
        return this._pool.getBrowser(this.browserId)
            .then((browser) => this._emit(RunnerEvents.SESSION_START, browser).thenResolve(browser));
    }

    freeBrowser(browser) {
        return this._emit(RunnerEvents.SESSION_END, browser)
            .then(() => this._pool.freeBrowser(browser));
    }

    _emit(event, browser) {
        return this.emitAndWait(event, browser.publicAPI, {browserId: browser.id})
            .catch((err) => logger.warn(err && err.stack || err));
    }
};
