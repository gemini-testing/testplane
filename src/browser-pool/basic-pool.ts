import debug from "debug";
import _ from "lodash";

import type { NewBrowser } from "../browser/new-browser";
import { CancelledError } from "./cancelled-error";
import { AsyncEmitter, MasterEvents } from "../events";
import { BrowserOpts, Pool } from "./types";
import { Config } from "../config";
import { Browser } from "../browser/browser";
import { WebdriverPool } from "./webdriver-pool";

export class BasicPool implements Pool {
    private _config: Config;
    private _emitter: AsyncEmitter;
    private _activeSessions: Record<string, NewBrowser>;
    private _cancelled: boolean;
    private _wdPool: WebdriverPool;
    log: debug.Debugger;

    static create(config: Config, emitter: AsyncEmitter): BasicPool {
        return new BasicPool(config, emitter);
    }

    constructor(config: Config, emitter: AsyncEmitter) {
        this._config = config;
        this._emitter = emitter;
        this.log = debug("testplane:pool:basic");

        this._activeSessions = {};
        this._cancelled = false;
        this._wdPool = new WebdriverPool();
    }

    async getBrowser(id: string, opts: BrowserOpts = {}): Promise<NewBrowser> {
        const { NewBrowser } = await import("../browser/new-browser");
        const browser = NewBrowser.create(this._config, { ...opts, id, wdPool: this._wdPool, emitter: this._emitter });

        try {
            await browser.init();
            this.log(`browser ${browser.fullId} started`);

            await this._emit(MasterEvents.SESSION_START, browser);

            if (this._cancelled) {
                throw new CancelledError();
            }

            await browser.reset();

            this._activeSessions[browser.sessionId] = browser;
            return browser;
        } catch (e) {
            if (browser.publicAPI) {
                await this.freeBrowser(browser);
            }

            throw e;
        }
    }

    async freeBrowser(browser: NewBrowser): Promise<void> {
        delete this._activeSessions[browser.sessionId];

        this.log(`stop browser ${browser.fullId}`);

        try {
            await this._emit(MasterEvents.SESSION_END, browser);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.warn((err && err.stack) || err);
        }

        await browser.quit();
    }

    private _emit(event: string, browser: Browser): Promise<unknown[]> {
        return this._emitter.emitAndWait(event, browser.publicAPI, {
            browserId: browser.id,
            sessionId: browser.sessionId,
        });
    }

    cancel(): void {
        this._cancelled = true;

        _.forEach(this._activeSessions, browser => browser.quit());

        this._activeSessions = {};
    }
}
