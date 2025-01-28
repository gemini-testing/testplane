export = BrowserAgent;
declare class BrowserAgent {
    static create(opts?: {}): import("./browser-agent");
    constructor({ id, version, pool }: {
        id: any;
        version: any;
        pool: any;
    });
    browserId: any;
    _version: any;
    _pool: any;
    _sessions: any[];
    getBrowser(opts?: {}): any;
    freeBrowser(browser: any, opts?: {}): any;
}
