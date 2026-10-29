import debug from "debug";

import type { NewBrowser } from "../browser/new-browser";
import { CancelledError } from "./cancelled-error";
import { AsyncEmitter, MasterEvents } from "../events";
import { BrowserOpts, Pool, PoolObserver } from "./types";
import { Config } from "../config";
import { Browser } from "../browser/browser";
import type { BrowserBackend } from "../browser-backend";
import { createBackend, getBackendKey } from "../browser-backend/factory";
import { AsyncCleanupStack } from "../utils/async-cleanup-stack";
import signalHandler from "../signal-handler";
import { warn } from "../utils/logger";

export class BasicPool implements Pool {
    private _config: Config;
    private _emitter: AsyncEmitter;
    private _activeSessions: Record<string, NewBrowser>;
    private _cancelled: boolean;
    private _cancelError: Error | null;
    private readonly _backends = new Map<string, Promise<BrowserBackend>>();
    private readonly _resources = new AsyncCleanupStack();
    private readonly _pending = new Set<Promise<unknown>>();
    private readonly _releasing = new WeakMap<NewBrowser, Promise<void>>();
    private _selectedIds: string[] = [];
    private _disposal: Promise<void> | null = null;
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
        this._cancelError = null;
        this._observer = isPoolObserver(observer) ? observer : undefined;
        const onExit = (error: Error): Promise<void> => {
            this.cancel(error);
            return this[Symbol.asyncDispose]();
        };
        signalHandler.on(MasterEvents.EXIT, onExit);
        this._resources.defer(() => {
            signalHandler.off(MasterEvents.EXIT, onExit);
        });
    }

    async prepare(browserIds: string[]): Promise<void> {
        if (this._cancelled) throw this._cancelError ?? new CancelledError();
        this._selectedIds = [...new Set([...this._selectedIds, ...browserIds])];
        await Promise.all(browserIds.map(id => this._getBackend(id)));
    }

    private _getBackend(id: string): Promise<BrowserBackend> {
        const key = getBackendKey(this._config.forBrowser(id));
        let backend = this._backends.get(key);
        if (!backend) {
            const ids = [...new Set([id, ...this._selectedIds])];
            backend = createBackend(this._config, ids);
            this._backends.set(key, backend);
            const pending = backend;
            this._resources.defer(async () => {
                const ready = await pending.catch(() => null);
                await ready?.[Symbol.asyncDispose]();
            });
            void backend.catch(() => {
                if (this._backends.get(key) === pending) this._backends.delete(key);
            });
        }
        return backend;
    }

    getBrowser(id: string, opts: BrowserOpts = {}): Promise<NewBrowser> {
        return this._track(this._getBrowser(id, opts));
    }

    private _track<T>(promise: Promise<T>): Promise<T> {
        this._pending.add(promise);
        const settled = (): void => {
            this._pending.delete(promise);
        };
        void promise.then(settled, settled);
        return promise;
    }

    private async _getBrowser(id: string, opts: BrowserOpts): Promise<NewBrowser> {
        if (this._cancelled) {
            throw this._cancelError ?? new CancelledError();
        }

        const operation = this._observer?.start("browser.session.create", { browserId: id });
        let browser: NewBrowser | null = null;

        try {
            const backend = await this._getBackend(id);
            if (this._cancelled) throw this._cancelError ?? new CancelledError();
            const { NewBrowser: NewBrowserClass } = await import("../browser/new-browser");
            browser = await NewBrowserClass.create(this._config, backend, {
                ...opts,
                id,
                emitter: this._emitter,
            });
            this.log(`browser ${browser.fullId} started`);

            await this._emit(MasterEvents.SESSION_START, browser);

            if (this._cancelled) {
                throw this._cancelError ?? new CancelledError();
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
        let releasing = this._releasing.get(browser);
        if (!releasing) {
            releasing = this._track(Promise.resolve().then(() => this._freeBrowser(browser)));
            this._releasing.set(browser, releasing);
        }
        return releasing;
    }

    private async _freeBrowser(browser: NewBrowser): Promise<void> {
        const operation = this._observer?.start("browser.session.quit", { browserId: browser.id });

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
            await browser.quit(error ?? this._cancelError);
            operation?.end();
        } catch (quitError) {
            operation?.end("failed");
            throw quitError;
        } finally {
            delete this._activeSessions[browser.sessionId];
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

    cancel(err?: Error): void {
        this._cancelled = true;
        this._cancelError ??= err ?? new CancelledError();

        for (const browser of Object.values(this._activeSessions)) {
            void this.freeBrowser(browser).catch(warn);
        }
    }

    [Symbol.asyncDispose](): Promise<void> {
        this._cancelled = true;
        this._disposal ??= this._dispose();
        return this._disposal;
    }

    private async _dispose(): Promise<void> {
        await using cleanup = new AsyncCleanupStack();
        cleanup.use(this._resources);
        await Promise.allSettled(this._pending);
        for (const browser of Object.values(this._activeSessions)) {
            cleanup.defer(() => this.freeBrowser(browser));
        }
        this._backends.clear();
    }
}

function isPoolObserver(value?: PoolObserver): value is PoolObserver {
    return typeof value?.start === "function" && typeof value.record === "function";
}
