export default class BrowserAgent {
    static create(opts = {}) {
        return new this(opts);
    }

    constructor({ id, version, pool }) {
        this.browserId = id;

        this._version = version;
        this._pool = pool;
        this._sessions = [];
    }

    async getBrowser(opts = {}) {
        const browser = await this._pool.getBrowser(this.browserId, { ...opts, version: this._version });
        if (!this._sessions.includes(browser.sessionId)) {
            this._sessions.push(browser.sessionId);
            return browser;
        }

        await this.freeBrowser(browser, { force: true });

        return this.getBrowser(opts);
    }

    freeBrowser(browser, opts = {}) {
        const force = opts.force || browser.state.isBroken;

        return this._pool.freeBrowser(browser, { force });
    }
}
