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
export declare class BrowserAgent {
    browserId: string;
    browserVersion: string;
    private _pool;
    static create(opts: CreateBrowserAgentOpts): BrowserAgent;
    constructor({ id, version, pool }: CreateBrowserAgentOpts);
    getBrowser({ sessionId, sessionCaps, sessionOpts, state, }: BrowserAgentBrowserOpts): Promise<ExistingBrowser>;
    freeBrowser(browser: ExistingBrowser): void;
}
