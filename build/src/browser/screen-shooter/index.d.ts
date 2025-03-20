export = ScreenShooter;
declare class ScreenShooter {
    static create(browser: any): import(".");
    constructor(browser: any);
    _browser: any;
    capture(page: any, opts?: {}): Promise<any>;
    _extendScreenshot(viewport: any, page: any, opts: any): Promise<any>;
    _extendImage(viewport: any, page: any, opts: any): Promise<void>;
}
