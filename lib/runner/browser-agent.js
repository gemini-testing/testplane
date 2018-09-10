'use strict';

const BaseBrowserAgent = require('gemini-core').BrowserAgent;

module.exports = class BrowserAgent {
    static create(...args) {
        return new this(...args);
    }

    constructor(...args) {
        this._agent = BaseBrowserAgent.create(...args);
    }

    getBrowser(...args) {
        return this._agent.getBrowser(...args);
    }

    freeBrowser(browser) {
        return this._agent.freeBrowser(browser, {force: browser.state.isBroken});
    }

    get browserId() {
        return this._agent.browserId;
    }
};
