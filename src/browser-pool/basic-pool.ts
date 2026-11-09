import debug from "debug";

import type { NewBrowser } from "../browser/new-browser";
import { CancelledError } from "./cancelled-error";
import { AsyncEmitter, MasterEvents } from "../events";
import { BrowserOpts, Pool, PoolObserver } from "./types";
import { Browser } from "../browser/browser";
import type { BrowserBackend } from "../browser-backend";
import { AsyncCleanupStack } from "../utils/async-cleanup-stack";
import signalHandler from "../signal-handler";
import { warn } from "../utils/logger";
import type { BrowserConfig } from "../config/browser-config";
import { getInstance } from "../config/runtime-config";
import { DOCKER_GRID_URL, LOCAL_GRID_URL } from "../constants/config";
import { groupBy } from "lodash";
import { LocalBrowserBackend, LocalBrowserBackendOptions } from "../browser-backend/local";
import { RemoteBrowserBackend } from "../browser-backend/remote";
import { DockerBrowserBackend } from "../browser-backend/docker";

type BrowserRuntimeOptions = LocalBrowserBackendOptions;

export function getBackendKey(config: BrowserConfig): string {
    if (getInstance().local || config.gridUrl === LOCAL_GRID_URL) {
        return "local";
    } else if (config.gridUrl === DOCKER_GRID_URL) {
        const docker = config.docker;

        return `docker:${JSON.stringify([
            docker?.socketPath ?? "/var/run/docker.sock",
            docker?.selenoidImage ?? null,
            docker?.selenoidPlatform ?? null,
        ])}`;
    }

    return `remote:${config.gridUrl}`;
}

export class BasicPool implements Pool, AsyncDisposable {
    // Owned
    private readonly _backends = new Map<string, BrowserBackend>();
    private readonly _cleanup = new AsyncCleanupStack();
    private readonly _activeSessions: Record<string, NewBrowser>;

    // Borrowed
    private _emitter: AsyncEmitter;
    private _observer?: PoolObserver;

    // Data
    private _browserRuntimeOptions: BrowserRuntimeOptions;
    private _cancelled: boolean;
    private _cancelError: Error | null;
    private _disposal: Promise<void> | null = null;
    private _pendingOperations: Set<Promise<unknown>> = new Set();
    private _pendingFreeBrowserOperations = new Map<NewBrowser, Promise<void>>();
    private readonly _pendingBackends = new Map<string, Promise<BrowserBackend>>();
    log: debug.Debugger;

    static create(
        browserRuntimeOptions: BrowserRuntimeOptions,
        emitter: AsyncEmitter,
        observer?: PoolObserver,
    ): BasicPool {
        return new BasicPool(browserRuntimeOptions, emitter, observer);
    }

    constructor(browserRuntimeOptions: BrowserRuntimeOptions, emitter: AsyncEmitter, observer?: PoolObserver) {
        this._browserRuntimeOptions = browserRuntimeOptions;
        this._emitter = emitter;
        this.log = debug("testplane:pool:basic");

        this._activeSessions = {};
        this._cancelled = false;
        this._cancelError = null;
        this._observer = observer;

        const onExit = (error: Error): Promise<void> => {
            this.cancel(error);
            return this[Symbol.asyncDispose]();
        };
        signalHandler.on(MasterEvents.EXIT, onExit);
        this._cleanup.defer(() => {
            signalHandler.off(MasterEvents.EXIT, onExit);
        });
    }

    async prewarm(browserConfigs: BrowserConfig[]): Promise<void> {
        return this._trackPending(this._prewarm(browserConfigs));
    }

    private async _prewarm(browserConfigs: BrowserConfig[]): Promise<void> {
        this._assertNotCancelled();

        const browserIdsByBackendKey = groupBy(browserConfigs, c => getBackendKey(c));
        for (const browserConfigs of Object.values(browserIdsByBackendKey)) {
            if (browserConfigs.length === 0) {
                continue;
            }

            const backend = await this._ensureBackend(browserConfigs[0], browserConfigs);
            this._assertNotCancelled();
            if (backend instanceof DockerBrowserBackend) {
                await backend.prewarm(browserConfigs);
            }
            this._assertNotCancelled();
        }
    }

    private async _ensureBackend(
        browserConfig: BrowserConfig,
        additionalBrowserConfigsToPrewarm?: BrowserConfig[],
    ): Promise<BrowserBackend> {
        const backendKey = getBackendKey(browserConfig);

        if (this._pendingBackends.has(backendKey)) {
            return this._pendingBackends.get(backendKey)!;
        }

        const result = this._ensureBackendImpl(browserConfig, additionalBrowserConfigsToPrewarm);
        this._pendingBackends.set(backendKey, result);

        result.then(
            () => this._pendingBackends.delete(backendKey),
            () => this._pendingBackends.delete(backendKey),
        );

        return result;
    }

    private async _ensureBackendImpl(
        browserConfig: BrowserConfig,
        additionalBrowserConfigsToPrewarm?: BrowserConfig[],
    ): Promise<BrowserBackend> {
        const backendKey = getBackendKey(browserConfig);

        if (this._backends.has(backendKey)) {
            return this._backends.get(backendKey)!;
        }

        let backend: BrowserBackend;
        if (backendKey === "local") {
            backend = new LocalBrowserBackend(this._browserRuntimeOptions);
        } else if (backendKey.startsWith("docker:")) {
            const browserConfigs = [...new Set([browserConfig, ...(additionalBrowserConfigsToPrewarm ?? [])])];
            backend = await DockerBrowserBackend.start(browserConfigs);
        } else {
            backend = new RemoteBrowserBackend(browserConfig.gridUrl);
        }

        this._cleanup.defer(async () => {
            // Retained sessions still need their driver or shared Docker controller.
            const retained = Object.values(this._activeSessions).some(
                browser => browser.state.isRetained && getBackendKey(browser.config) === backendKey,
            );
            if (!retained) {
                await backend[Symbol.asyncDispose]();
            }
        });
        this._backends.set(backendKey, backend);

        return backend;
    }

    private _assertNotCancelled(): void {
        if (this._cancelled) {
            throw this._cancelError ?? new CancelledError();
        }
    }

    private _trackPending<T>(promise: Promise<T>): Promise<T> {
        this._pendingOperations.add(promise);

        const remove = (): void => {
            this._pendingOperations.delete(promise);
        };
        void promise.then(remove, remove);

        return promise;
    }

    async getBrowser(browserConfig: BrowserConfig, opts: BrowserOpts = {}): Promise<NewBrowser> {
        return this._trackPending(this._getBrowser(browserConfig, opts));
    }

    private async _getBrowser(browserConfig: BrowserConfig, opts: BrowserOpts = {}): Promise<NewBrowser> {
        this._assertNotCancelled();

        const browserId = browserConfig.id;
        const operation = this._observer?.start("browser.session.create", { browserId });

        await using cleanup = new AsyncCleanupStack();
        cleanup.defer(() => operation?.end("failed"));
        const backend = await this._ensureBackend(browserConfig);
        this._assertNotCancelled();
        const { NewBrowser: NewBrowserClass } = await import("../browser/new-browser");
        const browser = await NewBrowserClass.create(browserConfig, backend, {
            ...opts,
            id: browserId,
            emitter: this._emitter,
        });

        cleanup.defer(async () => {
            delete this._activeSessions[browser.sessionId];
            await browser.quit(this._cancelError);
        });

        this.log(`browser ${browser.fullId} started`);

        await this._emit(MasterEvents.SESSION_START, browser);

        this._assertNotCancelled();
        await browser.reset();
        this._assertNotCancelled();

        operation?.end();
        this._activeSessions[browser.sessionId] = browser;
        this._observer?.record("sessionNew", { browserId });
        this._observer?.record("sessionsActive", {
            browserId,
            value: Object.values(this._activeSessions).filter(session => session.id === browserId).length,
        });

        cleanup.move();

        return browser;
    }

    freeBrowser(browser: NewBrowser): Promise<void> {
        const pending = this._pendingFreeBrowserOperations.get(browser);
        if (pending) return pending;

        const promise = Promise.resolve().then(() => this._freeBrowser(browser));
        this._pendingFreeBrowserOperations.set(browser, promise);
        promise.then(
            () => this._pendingFreeBrowserOperations.delete(browser),
            () => this._pendingFreeBrowserOperations.delete(browser),
        );

        return promise;
    }

    private async _freeBrowser(browser: NewBrowser): Promise<void> {
        if (!this._activeSessions[browser.sessionId]) {
            return;
        }

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
        const freeBrowserOperations = new Set(this._pendingFreeBrowserOperations.values());
        await Promise.allSettled(this._pendingOperations);

        for (const browser of Object.values(this._activeSessions)) {
            if (!browser.state.isRetained) {
                freeBrowserOperations.add(this.freeBrowser(browser));
            }
        }
        const freeBrowserResults = await Promise.allSettled(freeBrowserOperations);

        const disposalErrors = freeBrowserResults.flatMap(r => (r.status === "rejected" ? [r.reason] : []));

        await this._cleanup.disposeAsync().catch(e => disposalErrors.push(e));
        this._backends.clear();

        if (disposalErrors.length > 0) {
            throw new AggregateError(disposalErrors, "Failed to dispose browser pool");
        }
    }
}
