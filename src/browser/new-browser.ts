import { Browser, type BrowserOpts } from "./browser";
import type { Config } from "../config";
import type { BrowserBackendClient, BrowserSession } from "../browser-backend";
import { AsyncCleanupStack } from "../utils/async-cleanup-stack";
import { warn } from "../utils/logger";

export class NewBrowser extends Browser implements AsyncDisposable {
    private _cleanup = new AsyncCleanupStack();
    private _closing: Promise<void> | null = null;

    private constructor(
        config: Config,
        opts: BrowserOpts,
        private readonly _backend: BrowserBackendClient,
        private readonly _ownedSession: BrowserSession,
    ) {
        super(config, opts);
        this._session = _ownedSession.browser;
    }

    static async create(config: Config, backend: BrowserBackendClient, opts: BrowserOpts): Promise<NewBrowser> {
        await using cleanup = new AsyncCleanupStack();

        let force = true;
        const session = cleanup.adopt(
            await backend.createSession(config.forBrowser(opts.id), {
                browserVersionOverride: opts.version ?? null,
            }),
            session => backend.deleteSession(session, { force }),
        );
        const browser = new NewBrowser(config, opts, backend, session);

        browser._addCommands();
        browser.restoreHttpTimeout();
        await browser._setPageLoadTimeout();

        force = false;
        browser._cleanup = cleanup.move();

        return browser;
    }

    get cdpAvailable(): boolean | null {
        return this._ownedSession.cdpAvailable;
    }

    getDriverPid(): number | null {
        return this._ownedSession.driverPid;
    }

    reset(): Promise<void> {
        return Promise.resolve();
    }

    quit(error: Error | null = null): Promise<void> {
        if (error) this._exitError ??= error;
        this._closing ??= this._cleanup.disposeAsync();
        return this._closing;
    }

    async kill(): Promise<void> {
        await using cleanup = new AsyncCleanupStack();
        cleanup.defer(() => this.quit());
        await this._backend.deleteSession(this._ownedSession, { force: true });
    }

    [Symbol.asyncDispose](): Promise<void> {
        return this.quit();
    }

    private async _setPageLoadTimeout(): Promise<void> {
        if (!this._config.pageLoadTimeout) return;
        try {
            await this._session!.setTimeout({ pageLoad: this._config.pageLoadTimeout });
        } catch (error) {
            // Edge with W3C does not support setting the page load timeout.
            if (this._session!.isW3C && this.capabilities.browserName === "MicrosoftEdge") {
                warn(`WARNING: Can not set page load timeout: ${(error as Error).message}`);
            } else {
                throw error;
            }
        }
    }
}
