export function mkProvider(knownBrowsers: any, eventBus: any): (browserId: any) => BrowserVersionController;
export class BrowserVersionController {
    static create(...args: any[]): BrowserVersionController;
    constructor(browserId: any, eventBus: any);
    version(browserVersion: any): BrowserVersionController;
    #private;
}
