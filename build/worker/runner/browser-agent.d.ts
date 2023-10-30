export = BrowserAgent;
declare class BrowserAgent {
    static create(browserId: any, browserVersion: any, pool: any): import("./browser-agent");
    constructor(browserId: any, browserVersion: any, pool: any);
    browserId: any;
    browserVersion: any;
    _pool: any;
    getBrowser({ sessionId, sessionCaps, sessionOpts }: {
        sessionId: any;
        sessionCaps: any;
        sessionOpts: any;
    }): any;
    freeBrowser(browser: any): void;
}
