import type { Browser } from "../browser/browser";
import type { Pool } from "../browser-pool/types";
import type { BrowserConfig } from "../config/browser-config";

interface BrowserAgentOpts {
    browserConfig: BrowserConfig;
    version?: string;
    pool: Pool;
}

interface GetBrowserOpts {
    highPriority?: boolean;
}

interface FreeBrowserOpts {
    force?: boolean;
}

export class BrowserAgent {
    private readonly _versionOverride?: string;
    private readonly _pool: Pool;
    private readonly _browserConfig: BrowserConfig;
    private readonly _sessions: string[];

    static create(opts: BrowserAgentOpts): BrowserAgent {
        return new this(opts);
    }

    get browserId(): string {
        return this._browserConfig.id;
    }

    constructor({ browserConfig, version, pool }: BrowserAgentOpts) {
        this._browserConfig = browserConfig;
        this._versionOverride = version;
        this._pool = pool;
        this._sessions = [];
    }

    async getBrowser(opts: GetBrowserOpts = {}): Promise<Browser> {
        const browser = await this._pool.getBrowser(this._browserConfig, { ...opts, version: this._versionOverride });
        if (!this._sessions.includes(browser.sessionId)) {
            this._sessions.push(browser.sessionId);
            return browser;
        }

        await this.freeBrowser(browser, { force: true });

        return this.getBrowser(opts);
    }

    freeBrowser(browser: Browser, opts: FreeBrowserOpts = {}): Promise<void> {
        const force = opts.force || browser.state.isBroken;

        return this._pool.freeBrowser(browser, { force });
    }
}
