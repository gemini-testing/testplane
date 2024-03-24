export default class HighPriorityBrowserAgent {
    static create(...args) {
        return new this(...args);
    }

    constructor(browserAgent) {
        this._browserAgent = browserAgent;
    }

    getBrowser(opts = {}) {
        return this._browserAgent.getBrowser({ ...opts, highPriority: true });
    }

    freeBrowser(...args) {
        return this._browserAgent.freeBrowser(...args);
    }
}
