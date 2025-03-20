export = BrowserPool;
declare class BrowserPool {
    static create(config: any, emitter: any): import("./browser-pool");
    constructor(config: any, emitter: any);
    _config: any;
    _emitter: any;
    _calibrator: Calibrator;
    getBrowser({ browserId, browserVersion, sessionId, sessionCaps, sessionOpts, state }: {
        browserId: any;
        browserVersion: any;
        sessionId: any;
        sessionCaps: any;
        sessionOpts: any;
        state: any;
    }): Promise<ExistingBrowser>;
    freeBrowser(browser: any): void;
}
import { Calibrator } from "../../browser/calibrator";
import { ExistingBrowser } from "../../browser/existing-browser";
