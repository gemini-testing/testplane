import debug from "debug";
import _ from "lodash";

import type { NewBrowser } from "../browser/new-browser";
import { CancelledError } from "./cancelled-error";
import { AsyncEmitter, MasterEvents } from "../events";
import { BrowserOpts, Pool, PoolObserver } from "./types";
import { Config } from "../config";
import { Browser } from "../browser/browser";
import { WebdriverPool } from "./webdriver-pool";

export class BasicPool implements Pool {
    private _config: Config;
    private _emitter: AsyncEmitter;
    private _activeSessions: Record<string, NewBrowser>;
    private _cancelled: boolean;
    private _wdPool: WebdriverPool;
    private _observer?: PoolObserver;
    log: debug.Debugger;

    static create(config: Config, emitter: AsyncEmitter, observer?: PoolObserver): BasicPool {
        return new BasicPool(config, emitter, observer);
    }

    constructor(config: Config, emitter: AsyncEmitter, observer?: PoolObserver) {
        this._config = config;
        this._emitter = emitter;
        this.log = debug("testplane:pool:basic");

        this._activeSessions = {};
        this._cancelled = false;
        this._wdPool = new WebdriverPool();
        this._observer = isPoolObserver(observer) ? observer : undefined;
    }

    async getBrowser(id: string, opts: BrowserOpts = {}): Promise<NewBrowser> {
        const operation = this._observer?.start("browser.session.create", { browserId: id });
        let browser: NewBrowser | undefined;

        try {
            const { NewBrowser: NewBrowserClass } = await import("../browser/new-browser");
            browser = NewBrowserClass.create(this._config, {
                ...opts,
                id,
                wdPool: this._wdPool,
                emitter: this._emitter,
            });
            await browser.init();
            this.log(`browser ${browser.fullId} started`);

            await this._emit(MasterEvents.SESSION_START, browser);

            if (this._cancelled) {
                throw new CancelledError();
            }

            await browser.reset();

            this._activeSessions[browser.sessionId] = browser;
            operation?.end();
            this._observer?.record("sessionNew", { browserId: id });
            this._observer?.record("sessionsActive", {
                browserId: id,
                value: Object.values(this._activeSessions).filter(session => session.id === id).length,
            });
            return browser;
        } catch (e) {
            operation?.end("failed");
            if (browser?.publicAPI) {
                await this.freeBrowser(browser);
            }

            throw e;
        }
    }

    async freeBrowser(browser: NewBrowser): Promise<void> {
        const operation = this._observer?.start("browser.session.quit", { browserId: browser.id });
        delete this._activeSessions[browser.sessionId];

        this.log(`stop browser ${browser.fullId}`);

        let error;

        try {
            await this._emit(MasterEvents.SESSION_END, browser);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            error = err;
            console.warn((err && err.stack) || err);
        }

        try {
            await browser.quit(error);
            operation?.end();
        } catch (quitError) {
            operation?.end("failed");
            throw quitError;
        } finally {
            this._observer?.record("sessionsActive", {
                browserId: browser.id,
                value: Object.values(this._activeSessions).filter(session => session.id === browser.id).length,
            });
        }
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

function isPoolObserver(value?: PoolObserver): value is PoolObserver {
    return typeof value?.start === "function" && typeof value.record === "function";
}
