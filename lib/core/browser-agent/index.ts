import _ from 'lodash';

import type {FreeBrowserOpts, GetBrowserOpts, Pool} from '../types/pool';
import type NewBrowser from '../../browser/new-browser';

export default class BrowserAgent {
    private _sessions: Array<string> = [];

    static create(browserId: string, pool: Pool): BrowserAgent {
        return new BrowserAgent(browserId, pool);
    }

    constructor(public browserId: string, private _pool: Pool) {}

    async getBrowser(opts: GetBrowserOpts): Promise<NewBrowser> {
        const browser = await this._pool.getBrowser(this.browserId, opts);

        if (_.includes(this._sessions, browser.sessionId)) {
            await this.freeBrowser(browser, {force: true});

            return this.getBrowser(opts);
        }

        this._sessions.push(browser.sessionId);

        return browser;
    }

    async freeBrowser(browser: NewBrowser, opts: FreeBrowserOpts): Promise<void> {
        return this._pool.freeBrowser(browser, opts);
    }
}
