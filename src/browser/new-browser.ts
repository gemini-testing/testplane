import { Browser, type BrowserOpts } from "./browser";
import type { BrowserBackendClient } from "../browser-backend";
import { AsyncCleanupStack } from "../utils/async-cleanup-stack";
import { warn } from "../utils/logger";
import { BrowserConfig } from "../config/browser-config";

export class NewBrowser extends Browser implements AsyncDisposable {
    private _cleanup = new AsyncCleanupStack();
    private _closing: Promise<void> | null = null;
    private _forceClose = true;

    private constructor(
        config: BrowserConfig,
        opts: BrowserOpts,
        private readonly _backend: BrowserBackendClient,
    ) {
        super(config, opts);
    }

    static async create(config: BrowserConfig, backend: BrowserBackendClient, opts: BrowserOpts): Promise<NewBrowser> {
        await using cleanup = new AsyncCleanupStack();

        const browser = new NewBrowser(config, opts, backend);
        browser._session = cleanup.adopt(
            await backend.startSession(config, {
                browserVersionOverride: opts.version ?? null,
            }),
            session => backend.deleteSession(session, { force: browser._forceClose }),
        );

        browser._addCommands();
        browser.restoreHttpTimeout();
        await browser._setPageLoadTimeout();

        browser._forceClose = false;
        browser._cleanup = cleanup.move();

        return browser;
    }

    get cdpAvailable(): boolean {
        return this._backend.isCdpAvailable?.(this._session!) ?? true;
    }

    getDriverPid(): number | null {
        return this._backend.getDriverPid?.(this._session!) ?? null;
    }

    reset(): Promise<void> {
        return Promise.resolve();
    }

    quit(error: Error | null = null): Promise<void> {
        if (error) {
            this._exitError ??= error;
        }

        this._closing ??= this._cleanup.disposeAsync();

        return this._closing;
    }

    async kill(): Promise<void> {
        this._forceClose = true;

        if (this._closing) {
            // Graceful cleanup already started: prevent the driver from being reused.
            await this._backend.deleteSession(this._session!, { force: true });
        }

        await this.quit();
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
