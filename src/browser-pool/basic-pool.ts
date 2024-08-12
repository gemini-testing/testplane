"use strict";

import _ from "lodash";
import NewBrowser from "../browser/new-browser";
import { CancelledError } from "./cancelled-error";
import { AsyncEmitter, MasterEvents } from "../events";
import Pool from "./pool";
import debug from "debug";
import { Config } from "../config";
import Browser from "../browser/browser";

class BasicPool implements Pool {
    _config: Config;
    _emitter: AsyncEmitter;
    log: debug.Debugger;
    _activeSessions: Record<string, NewBrowser>;
    _cancelled: boolean;

    static create(config: Config, emitter: AsyncEmitter): BasicPool {
        return new BasicPool(config, emitter);
    }

    constructor(config: Config, emitter: AsyncEmitter) {
        this._config = config;
        this._emitter = emitter;
        this.log = debug("testplane:pool:basic");

        this._activeSessions = {};
        this._cancelled = false;
    }

    async getBrowser(id: string, opts = {}): Promise<NewBrowser> {
        const browser = NewBrowser.create(this._config, { ...opts, id }) as NewBrowser;

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

    _emit(event: string, browser: Browser): Promise<unknown[]> {
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

export default BasicPool;
