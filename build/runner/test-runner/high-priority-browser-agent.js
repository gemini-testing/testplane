'use strict';
module.exports = class HighPriorityBrowserAgent {
    static create(...args) {
        return new this(...args);
    }
    constructor(browserAgent) {
        this._browserAgent = browserAgent;
    }
    getBrowser() {
        return this._browserAgent.getBrowser({ highPriority: true });
    }
    freeBrowser(...args) {
        return this._browserAgent.freeBrowser(...args);
    }
};
