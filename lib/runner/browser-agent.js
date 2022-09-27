'use strict';

const BaseBrowserAgent = require('../core/browser-agent').default;

module.exports = class BrowserAgent {
    static create(id, version, pool) {
        return new this(id, version, pool);
    }

    constructor(id, version, pool) {
        this._version = version;
        this._agent = BaseBrowserAgent.create(id, pool);
    }

    getBrowser(opts = {}) {
        opts.version = this._version;

        return this._agent.getBrowser(opts);
    }

    freeBrowser(browser) {
        return this._agent.freeBrowser(browser, {force: browser.state.isBroken});
    }

    get browserId() {
        return this._agent.browserId;
    }
};
