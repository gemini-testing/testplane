import _ from "lodash";
import debug from "debug";

import Browser from "../browser/new-browser.js";
import { CancelledError } from "./cancelled-error.js";
import { MasterEvents } from "../events/index.js";
import Pool from "./pool.js";

export default class BasicPool extends Pool {
    static create(config, emitter) {
        return new BasicPool(config, emitter);
    }

    constructor(config, emitter) {
        super();

        this._config = config;
        this._emitter = emitter;
        this.log = debug("hermione:pool:basic");

        this._activeSessions = {};
    }

    async getBrowser(id, opts = {}) {
        const browser = Browser.create(this._config, { ...opts, id });

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

    async freeBrowser(browser) {
        delete this._activeSessions[browser.sessionId];

        this.log(`stop browser ${browser.fullId}`);

        try {
            await this._emit(MasterEvents.SESSION_END, browser);
        } catch (err) {
            console.warn((err && err.stack) || err);
        }

        await browser.quit();
    }

    _emit(event, browser) {
        return this._emitter.emitAndWait(event, browser.publicAPI, {
            browserId: browser.id,
            sessionId: browser.sessionId,
        });
    }

    cancel() {
        this._cancelled = true;

        _.forEach(this._activeSessions, browser => browser.quit());

        this._activeSessions = {};
    }
}
