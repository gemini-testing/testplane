export = OneTimeScreenshooter;
declare class OneTimeScreenshooter {
    static create(...args: any[]): import("./one-time-screenshooter");
    constructor(config: any, browser: any);
    _config: any;
    _browser: any;
    _screenshot: void | {
        base64: any;
        size: any;
    } | null;
    _alreadyTryToScreenshot: boolean;
    _screenshooter: ScreenShooter;
    _screenshotTimeout: any;
    extendWithScreenshot(error: any): globalThis.Promise<any>;
    captureScreenshotOnAssertViewFail(): globalThis.Promise<void>;
    _captureScreenshot(): globalThis.Promise<void>;
    _makeScreenshot(): globalThis.Promise<{
        base64: any;
        size: any;
    }>;
    _makeFullPageScreenshot(): globalThis.Promise<{
        base64: any;
        size: any;
    }>;
    _getPageSize(): globalThis.Promise<any>;
    _makeViewportScreenshot(): globalThis.Promise<{
        base64: any;
        size: {
            width: number;
            height: number;
        };
    }>;
    getScreenshot(): void | {
        base64: any;
        size: any;
    } | null;
}
import ScreenShooter = require("../../../browser/screen-shooter");
