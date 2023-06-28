export = ExistingBrowser;
declare class ExistingBrowser extends Browser {
    static create(config: any, id: any, version: any, emitter: any): import("./existing-browser");
    constructor(config: any, id: any, version: any, emitter: any);
    _emitter: any;
    _camera: Camera;
    _meta: any;
    init({ sessionId, sessionCaps, sessionOpts }: {
        sessionId: any;
        sessionCaps: any;
        sessionOpts: any;
    } | undefined, calibrator: any): Promise<import("./existing-browser")>;
    reinit(sessionId: any, sessionOpts: any): Promise<import("./existing-browser")>;
    markAsBroken(): void;
    quit(): void;
    prepareScreenshot(selectors: any, opts?: {}): Promise<any>;
    open(url: any): any;
    evalScript(script: any): any;
    injectScript(script: any): any;
    captureViewportImage(page: any, screenshotDelay: any): Promise<import("../image")>;
    scrollBy(params: any): any;
    _attachSession({ sessionId, sessionCaps, sessionOpts }: {
        sessionId: any;
        sessionCaps: any;
        sessionOpts?: {} | undefined;
    }): Promise<WebdriverIO.Browser>;
    _initMeta(): any;
    _takeScreenshot(): any;
    _addMetaAccessCommands(session: any): void;
    _decorateUrlMethod(session: any): void;
    _resolveUrl(uri: any): any;
    _prepareSession(sessionId: any): Promise<void>;
    _setOrientation(orientation: any): Promise<void>;
    _setWindowSize(size: any): Promise<void>;
    _performCalibration(calibrator: any): any;
    _calibration: any;
    _buildClientScripts(): any;
    _clientBridge: any;
    _attach(sessionId: any): void;
    _stubCommands(): void;
    get meta(): any;
    get emitter(): any;
}
import Browser = require("./browser");
import Camera = require("./camera");
