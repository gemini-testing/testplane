import type { BrowserConfig } from "../config/browser-config";
import { AsyncCleanupStack } from "../utils/async-cleanup-stack";
import type { BrowserBackend, BrowserBackendOptions, BrowserSession, SessionCloseOptions } from "./index";
import type { SessionState } from "./session";

export type SessionInfo = Pick<BrowserSession, "browser"> & Partial<Pick<BrowserSession, "driverPid" | "cdpAvailable">>;

/** Owns sessions and waits for acquisitions before releasing shared infrastructure. */
export abstract class BaseBrowserBackend implements BrowserBackend {
    protected readonly resources = new AsyncCleanupStack();
    private readonly sessions = new Set<BrowserSession>();
    private readonly pending = new Set<Promise<BrowserSession>>();
    private disposal: Promise<void> | null = null;
    private closed = false;

    createSession(config: BrowserConfig, options: BrowserBackendOptions = {}): Promise<BrowserSession> {
        if (this.closed) return Promise.reject(new Error("Browser backend is disposed"));

        const pending = this.acquire(config, options);
        this.pending.add(pending);
        const settled = (): void => {
            this.pending.delete(pending);
        };
        void pending.then(settled, settled);
        return pending;
    }

    private async acquire(config: BrowserConfig, options: BrowserBackendOptions): Promise<BrowserSession> {
        await using cleanup = new AsyncCleanupStack();
        const state: SessionState = { force: false, deleted: false };
        // Failures during startup must never return a driver to its pool.
        try {
            const info = await this.startSession(config, options, cleanup, state);
            if (this.closed) throw new Error("Browser backend is disposed");
            const resources = cleanup.move();
            let closing: Promise<void> | null = null;
            const session: BrowserSession = {
                browser: info.browser,
                driverPid: info.driverPid ?? null,
                cdpAvailable: info.cdpAvailable ?? null,
                close: ({ force = false } = {}): Promise<void> => {
                    state.force ||= force;
                    closing ??= resources.disposeAsync().finally(() => this.sessions.delete(session));
                    return closing;
                },
                [Symbol.asyncDispose]: (): Promise<void> => session.close(),
            };
            this.sessions.add(session);
            return session;
        } catch (error) {
            state.force = true;
            throw error;
        }
    }

    deleteSession(session: BrowserSession, options?: SessionCloseOptions): Promise<void> {
        return session.close(options);
    }

    [Symbol.asyncDispose](): Promise<void> {
        this.closed = true;
        this.disposal ??= this.disposeResources();
        return this.disposal;
    }

    private async disposeResources(): Promise<void> {
        await using cleanup = new AsyncCleanupStack();
        cleanup.use(this.resources);
        await Promise.allSettled(this.pending);
        for (const session of this.sessions) cleanup.use(session);
    }

    protected abstract startSession(
        config: BrowserConfig,
        options: BrowserBackendOptions,
        cleanup: AsyncCleanupStack,
        state: SessionState,
    ): Promise<SessionInfo>;
}
