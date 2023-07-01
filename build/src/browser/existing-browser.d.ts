export = ExistingBrowser;
declare class ExistingBrowser extends Browser {
    static create(config: any, id: any, version: any, emitter: any): import("./existing-browser");
    constructor(config: any, id: any, version: any, emitter: any);
    originalSessionId: null;
    originalCaps: null;
    originalOpts: null;
    newOpts: null;
    _browserContext: null;
    _emitter: any;
    _camera: Camera;
    _meta: any;
    init({ sessionId, sessionCaps, sessionOpts }: {
        sessionId: any;
        sessionCaps: any;
        sessionOpts: any;
    } | undefined, calibrator: any): globalThis.Promise<import("./existing-browser")>;
    reinit(sessionId: any, sessionOpts: any, sessionCaps: any): globalThis.Promise<import("./existing-browser")>;
    getPuppeteer(): globalThis.Promise<any>;
    _cycleBrowserContext(): globalThis.Promise<void>;
    markAsBroken(): void;
    quit(): void;
    prepareScreenshot(selectors: any, opts?: {}): globalThis.Promise<any>;
    open(url: any): any;
    evalScript(script: any): any;
    injectScript(script: any): any;
    captureViewportImage(page: any, screenshotDelay: any): globalThis.Promise<import("../image")>;
    scrollBy(params: any): any;
    _getOptions({ sessionId, sessionCaps, sessionOpts }: {
        sessionId: any;
        sessionCaps: any;
        sessionOpts?: {} | undefined;
    }): any;
    _attachSession({ sessionId, sessionCaps, sessionOpts }: {
        sessionId: any;
        sessionCaps: any;
        sessionOpts?: {} | undefined;
    }): globalThis.Promise<WebdriverIO.Browser>;
    _initMeta(): any;
    _takeScreenshot(): any;
    _addMetaAccessCommands(session: any): void;
    _decorateUrlMethod(session: any): void;
    _resolveUrl(uri: any): any;
    _prepareSession(sessionId: any): globalThis.Promise<void>;
    _setOrientation(orientation: any): globalThis.Promise<void>;
    _setWindowSize(size: any): globalThis.Promise<void>;
    _performCalibration(calibrator: any): any;
    _calibration: any;
    _buildClientScripts(): Promise<clientBridge.ClientBridge>;
    _clientBridge: clientBridge.ClientBridge | undefined;
    _attach(sessionId: any): void;
    _stubCommands(): void;
    get meta(): any;
    get emitter(): any;
}
import Browser = require("./browser");
import Camera = require("./camera");
import clientBridge = require("./client-bridge");
import Promise = require("bluebird");
