export = BrowserAgent;
declare class BrowserAgent {
    static create(id: any, version: any, pool: any): import("./browser-agent");
    constructor(id: any, version: any, pool: any);
    browserId: any;
    _version: any;
    _pool: any;
    _sessions: any[];
    getBrowser(opts?: {}): any;
    freeBrowser(browser: any, opts?: {}): any;
}
