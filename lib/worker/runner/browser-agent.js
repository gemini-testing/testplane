'use strict';

module.exports = class BrowserAgent {
    static create(browserId, browserVersion, pool) {
        return new BrowserAgent(browserId, browserVersion, pool);
    }

    constructor(browserId, browserVersion, pool) {
        this.browserId = browserId;
        this.browserVersion = browserVersion;

        this._pool = pool;
    }

    getBrowser(sessionId) {
        return this._pool.getBrowser(this.browserId, this.browserVersion, sessionId);
    }

    freeBrowser(browser) {
        this._pool.freeBrowser(browser);
    }
};
