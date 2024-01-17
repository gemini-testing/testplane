export = BrowserConfig;
declare class BrowserConfig {
    constructor(browserOptions: any);
    getScreenshotPath(test: any, stateName: any): string;
    serialize(): Partial<import("./browser-config")>;
}
