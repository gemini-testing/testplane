'use strict';

const _ = require('lodash');
const BasicPool = require('./basic');

module.exports = class CachingPool extends BasicPool {
    static create(...args) {
        return new this(...args);
    }

    constructor(...args) {
        super(...args);

        this._cachedBrowsers = {};
    }

    async getBrowser(browserOpts) {
        const {browserId, browserVersion, sessionId, sessionOpts} = browserOpts;
        this._cachedBrowsers[browserId] = this._cachedBrowsers[browserId] || [];

        let browser = _.find(this._cachedBrowsers[browserId], (browser) => {
            return browserVersion
                ? _.isNil(browser.sessionId) && browser.version === browserVersion
                : _.isNil(browser.sessionId);
        });

        if (!browser) {
            browser = await super.getBrowser(browserOpts);
            this._cachedBrowsers[browserId].push(browser);

            return browser;
        }

        try {
            return await browser.reinit(sessionId, sessionOpts);
        } catch (error) {
            super._handleError(error, browser, sessionId);
        }
    }

    freeBrowser(browser) {
        if (browser.state.isBroken) {
            _.pull(this._cachedBrowsers[browser.id], browser);
        }

        super.freeBrowser(browser);
    }
};
