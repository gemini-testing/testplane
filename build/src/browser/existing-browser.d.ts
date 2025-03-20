import { Browser, BrowserOpts } from "./browser";
import { Camera, PageMeta } from "./camera";
import { type ClientBridge } from "./client-bridge";
import { Config } from "../config";
import { Image, Rect } from "../image";
import type { CalibrationResult, Calibrator } from "./calibrator";
import type { Options } from "@testplane/wdio-types";
interface SessionOptions {
    sessionId: string;
    sessionCaps?: WebdriverIO.Capabilities;
    sessionOpts?: Options.WebdriverIO & {
        capabilities: WebdriverIO.Capabilities;
    };
}
interface PrepareScreenshotOpts {
    disableAnimation?: boolean;
}
interface ScrollByParams {
    x: number;
    y: number;
    selector?: string;
}
export declare class ExistingBrowser extends Browser {
    protected _camera: Camera;
    protected _meta: Record<string, unknown>;
    protected _calibration?: CalibrationResult;
    protected _clientBridge?: ClientBridge;
    constructor(config: Config, opts: BrowserOpts);
    init({ sessionId, sessionCaps, sessionOpts }: SessionOptions, calibrator: Calibrator): Promise<this>;
    markAsBroken(): void;
    quit(): void;
    prepareScreenshot(selectors: string[] | Rect[], opts?: PrepareScreenshotOpts): Promise<unknown>;
    cleanupScreenshot(opts?: {
        disableAnimation?: boolean;
    }): Promise<void>;
    open(url: string): Promise<WebdriverIO.Request | string | void>;
    evalScript<T>(script: string): Promise<T>;
    injectScript(script: string): Promise<unknown>;
    captureViewportImage(page?: PageMeta, screenshotDelay?: number): Promise<Image>;
    scrollBy(params: ScrollByParams): Promise<void>;
    protected _attachSession({ sessionId, sessionCaps, sessionOpts, }: SessionOptions): Promise<WebdriverIO.Browser>;
    protected _initMeta(): Record<string, unknown>;
    protected _takeScreenshot(): Promise<string>;
    protected _addCommands(): void;
    protected _overrideGetElementsList(session: WebdriverIO.Browser): void;
    protected _addMetaAccessCommands(session: WebdriverIO.Browser): void;
    protected _decorateUrlMethod(session: WebdriverIO.Browser): void;
    protected _resolveUrl(uri: string): string;
    protected _performIsolation({ sessionCaps, sessionOpts, }: Pick<SessionOptions, "sessionCaps" | "sessionOpts">): Promise<void>;
    protected _prepareSession(): Promise<void>;
    protected _setOrientation(orientation: string | null): Promise<void>;
    protected _setWindowSize(size: {
        width: number;
        height: number;
    } | null): Promise<void>;
    protected _performCalibration(calibrator: Calibrator): Promise<void>;
    protected _buildClientScripts(): Promise<ClientBridge>;
    protected _runInEachIframe(cb: (...args: unknown[]) => unknown): Promise<void>;
    protected _disableFrameAnimations(): Promise<void>;
    protected _disableIframeAnimations(): Promise<void>;
    protected _cleanupFrameAnimations(): Promise<void>;
    protected _cleanupIframeAnimations(): Promise<void>;
    protected _cleanupPageAnimations(): Promise<void>;
    _stubCommands(): void;
    get meta(): Record<string, unknown>;
}
export {};
