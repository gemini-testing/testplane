import Bluebird from 'bluebird';
import debug from 'debug';
import _ from 'lodash';

import CancelledError from '../errors/cancelled-error';

import type {BrowserManager, GetBrowserOpts, Pool} from '../types/pool';
import type NewBrowser from '../../browser/new-browser';

type BasicPoolOpts = {
    logNamespace: string;
};

export default class BasicPool implements Pool {
    log: debug.Debugger;
    private _browserMgr: BrowserManager;
    private _activeSessions: Record<string, NewBrowser>;
    private _cancelled?: boolean;

    static create(browserManager: BrowserManager, opts: BasicPoolOpts): BasicPool {
        return new BasicPool(browserManager, opts);
    }

    constructor(browserManager: BrowserManager, opts: BasicPoolOpts) {
        this._browserMgr = browserManager;
        this.log = debug(`${opts.logNamespace}:pool:basic`);

        this._activeSessions = {};
    }

    async getBrowser(id: string, opts: GetBrowserOpts = {}): Promise<NewBrowser> {
        const {version} = opts;
        const browser = this._browserMgr.create(id, version);

        await this._browserMgr.start(browser);
        this.log(`browser ${browser.fullId} started`);
        this._browserMgr.onStart(browser);

        if (this._cancelled) {
            return Bluebird.reject(new CancelledError());
        }

        this._activeSessions[browser.sessionId] = browser;
        await browser.reset();

        return browser;
    }

    async freeBrowser(browser: NewBrowser): Promise<void> {
        delete this._activeSessions[browser.sessionId];

        this.log(`stop browser ${browser.fullId}`);

        try {
            await this._browserMgr.onQuit(browser);
        } catch (err: unknown) {
            console.warn(err instanceof Error ? err.stack : err);
        }

        return this._browserMgr.quit(browser);
    }

    cancel(): void {
        this._cancelled = true;

        _.forEach(this._activeSessions, (browser) => this._browserMgr.quit(browser));

        this._activeSessions = {};
    }
}
