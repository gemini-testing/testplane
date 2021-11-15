import Browser from "../../browser/existing-browser";

import type BrowserPool from "./browser-pool";

export default class BrowserAgent {
    public static create(browserId: string, browserVersion: string, pool: BrowserPool): BrowserAgent {
        return new BrowserAgent(browserId, browserVersion, pool);
    }

    constructor(public browserId: string, public browserVersion: string, private _pool: BrowserPool) {}

    public async getBrowser({sessionId, sessionCaps, sessionOpts}): Promise<Browser> {
        return this._pool.getBrowser({
            browserId: this.browserId,
            browserVersion: this.browserVersion,
            sessionId,
            sessionCaps,
            sessionOpts
        });
    }

    public freeBrowser(browser: Browser): void {
        this._pool.freeBrowser(browser);
    }
};
