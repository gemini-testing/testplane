"use strict";

module.exports = class BrowserAgent {
    static create(opts) {
        return new this(opts);
    }

    constructor({ id, version, pool }) {
        this.browserId = id;
        this.browserVersion = version;

        this._pool = pool;
    }

    getBrowser({ sessionId, sessionCaps, sessionOpts, testXReqId }) {
        return this._pool.getBrowser({
            browserId: this.browserId,
            browserVersion: this.browserVersion,
            sessionId,
            sessionCaps,
            sessionOpts,
            testXReqId,
        });
    }

    freeBrowser(browser) {
        this._pool.freeBrowser(browser);
    }
};
