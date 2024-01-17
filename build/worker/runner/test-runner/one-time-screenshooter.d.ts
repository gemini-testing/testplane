export = OneTimeScreenshooter;
declare class OneTimeScreenshooter {
    static create(...args: any[]): import("./one-time-screenshooter");
    constructor(config: any, browser: any);
    _config: any;
    _browser: any;
    _screenshot: any;
    _alreadyTryToScreenshot: boolean;
    _screenshooter: ScreenShooter;
    _screenshotTimeout: any;
    extendWithScreenshot(error: any): Promise<any>;
    captureScreenshotOnAssertViewFail(): Promise<void>;
    _captureScreenshot(): Promise<void>;
    _makeScreenshot(): Promise<{
        base64: any;
        size: any;
    }>;
    _makeFullPageScreenshot(): Promise<{
        base64: any;
        size: any;
    }>;
    _getPageSize(): Promise<any>;
    _makeViewportScreenshot(): Promise<{
        base64: any;
        size: any;
    }>;
    getScreenshot(): any;
}
import ScreenShooter = require("../../../browser/screen-shooter");
