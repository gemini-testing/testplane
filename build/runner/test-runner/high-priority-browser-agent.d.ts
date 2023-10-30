export = HighPriorityBrowserAgent;
declare class HighPriorityBrowserAgent {
    static create(...args: any[]): import("./high-priority-browser-agent");
    constructor(browserAgent: any);
    _browserAgent: any;
    getBrowser(): any;
    freeBrowser(...args: any[]): any;
}
