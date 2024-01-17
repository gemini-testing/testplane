export = BrowserAgent;
declare class BrowserAgent {
    static create(opts: any): import("./browser-agent");
    constructor({ id, version, pool }: {
        id: any;
        version: any;
        pool: any;
    });
    browserId: any;
    browserVersion: any;
    _pool: any;
    getBrowser({ sessionId, sessionCaps, sessionOpts, state }: {
        sessionId: any;
        sessionCaps: any;
        sessionOpts: any;
        state: any;
    }): any;
    freeBrowser(browser: any): void;
}
