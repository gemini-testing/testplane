import { ExistingBrowser } from "../../browser/existing-browser";
import { WdioBrowser } from "../../types";
import BrowserPool from "./browser-pool";

export type BrowserAgentBrowserOpts = {
    sessionId: string;
    sessionCaps: WdioBrowser["capabilities"];
    sessionOpts: WdioBrowser["options"];
    state: Record<string, unknown>;
};

export type CreateBrowserAgentOpts = {
    id: string;
    version: string;
    pool: BrowserPool;
};

export class BrowserAgent {
    browserId: string;
    browserVersion: string;
    private _pool: BrowserPool;

    static create(opts: CreateBrowserAgentOpts): BrowserAgent {
        return new this(opts);
    }

    constructor({ id, version, pool }: CreateBrowserAgentOpts) {
        this.browserId = id;
        this.browserVersion = version;

        this._pool = pool;
    }

    async getBrowser({
        sessionId,
        sessionCaps,
        sessionOpts,
        state,
    }: BrowserAgentBrowserOpts): Promise<ExistingBrowser> {
        return this._pool.getBrowser({
            browserId: this.browserId,
            browserVersion: this.browserVersion,
            sessionId,
            sessionCaps,
            sessionOpts,
            state,
        });
    }

    freeBrowser(browser: ExistingBrowser): void {
        this._pool.freeBrowser(browser);
    }
}
