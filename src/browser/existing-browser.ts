import url from "url";
import _ from "lodash";
import type {AttachOptions, ChainablePromiseArray, ElementArray} from "webdriverio";
import {attach} from "webdriverio";
import { sessionEnvironmentDetector } from "../bundle/@wdio-utils";
import {Browser, BrowserOpts} from "./browser";
import { customCommandFileNames } from "./commands";
import {Camera, PageMeta} from "./camera";
import {type ClientBridge, build as buildClientBridge} from "./client-bridge";
import * as history from "./history";
import * as logger from "../utils/logger";
import { WEBDRIVER_PROTOCOL } from "../constants/config";
import { MIN_CHROME_VERSION_SUPPORT_ISOLATION } from "../constants/browser";
import { isSupportIsolation } from "../utils/browser";
import { isRunInNodeJsEnv } from "../utils/config";
import {Config} from "../config";
import {Image, Rect} from "../image";
import type {CalibrationResult, Calibrator} from "./calibrator";
import {NEW_ISSUE_LINK} from "../constants/help";
import type {Options} from "@wdio/types";

const OPTIONAL_SESSION_OPTS = ["transformRequest", "transformResponse"];

interface SessionOptions {
    sessionId: string;
    sessionCaps?: WebdriverIO.Capabilities;
    sessionOpts?: Options.WebdriverIO;
}

interface PrepareScreenshotOpts {
    disableAnimation?: boolean;
    // TODO: specify the rest of the options
}

interface ClientBridgeErrorData {
    error: string;
    message: string;
}

interface ScrollByParams {
    x: number;
    y: number;
    selector?: string;
}

const BROWSER_SESSION_HINT = "browser session";
const CLIENT_BRIDGE_HINT = "client bridge";

function ensure<T>(value: T | undefined | null, hint?: string): asserts value is T {
    if (!value) {
        throw new Error(`Execution can't proceed, because a crucial component was not initialized${hint ? " (" + hint + ")" : ""}. This is likely due to a bug on our side.\n` +
            `\nPlease file an issue at ${NEW_ISSUE_LINK}, we will try to fix it as soon as possible.`);
    }
}

const isClientBridgeErrorData = (data: unknown): data is ClientBridgeErrorData => {
    return Boolean(data && (data as ClientBridgeErrorData).error && (data as ClientBridgeErrorData).message);
}

export class ExistingBrowser extends Browser {
    protected _camera: Camera;
    protected _meta: Record<string, unknown>;
    protected _calibration?: CalibrationResult;
    protected _clientBridge?: ClientBridge;

    constructor(config: Config, opts: BrowserOpts) {
        super(config, opts);

        this._camera = Camera.create(this._config.screenshotMode, () => this._takeScreenshot());

        this._meta = this._initMeta();
    }

    async init({ sessionId, sessionCaps, sessionOpts }: SessionOptions, calibrator: Calibrator): Promise<this> {
        this._session = await this._attachSession({ sessionId, sessionCaps, sessionOpts });

        if (!isRunInNodeJsEnv(this._config)) {
            this._startCollectingCustomCommands();
        }

        this._extendStacktrace();
        this._addSteps();
        this._addHistory();

        await history.runGroup(this._callstackHistory, "testplane: init browser", async () => {
            this._addCommands();
            await this._performIsolation({ sessionCaps, sessionOpts });

            try {
                this.config.prepareBrowser && this.config.prepareBrowser(this.publicAPI);
            } catch (e: unknown) {
                logger.warn(`WARN: couldn't prepare browser ${this.id}\n`, (e as Error)?.stack);
            }

            await this._prepareSession();
            await this._performCalibration(calibrator);
            await this._buildClientScripts();
        });

        return this;
    }

    markAsBroken(): void {
        if (this.state.isBroken) {
            return;
        }

        this.applyState({ isBroken: true });

        this._stubCommands();
    }

    quit(): void {
        this._meta = this._initMeta();
    }

    async prepareScreenshot(selectors: string[] | Rect[], opts: PrepareScreenshotOpts = {}): Promise<unknown> {
        opts = _.extend(opts, {
            usePixelRatio: this._calibration ? this._calibration.usePixelRatio : true,
        });

        ensure(this._clientBridge, CLIENT_BRIDGE_HINT);
        const result = await this._clientBridge.call("prepareScreenshot", [selectors, opts]);
        if (isClientBridgeErrorData(result)) {
            throw new Error(`Prepare screenshot failed with error type '${result.error}' and error message: ${result.message}`);
        }

        // https://github.com/webdriverio/webdriverio/issues/11396
        if (this._config.automationProtocol === WEBDRIVER_PROTOCOL && opts.disableAnimation) {
            await this._disableIframeAnimations();
        }

        return result;
    }

    async cleanupScreenshot(opts: {disableAnimation?: boolean} = {}): Promise<void> {
        if (opts.disableAnimation) {
            await this._cleanupPageAnimations();
        }
    }

    open(url: string): Promise<string> {
        ensure(this._session, BROWSER_SESSION_HINT);

        return this._session.url(url);
    }

    evalScript<T>(script: string): Promise<T> {
        ensure(this._session, BROWSER_SESSION_HINT);

        return this._session.execute(`return ${script}`);
    }

    injectScript(script: string): Promise<unknown> {
        ensure(this._session, BROWSER_SESSION_HINT);

        return this._session.execute(script);
    }

    async captureViewportImage(page?: PageMeta, screenshotDelay?: number): Promise<Image> {
        if (screenshotDelay) {
            await new Promise((resolve) => setTimeout(resolve, screenshotDelay));
        }

        return this._camera.captureViewportImage(page);
    }

    scrollBy(params: ScrollByParams): Promise<void> {
        ensure(this._session, BROWSER_SESSION_HINT);

        return this._session.execute(function (params) {
            // eslint-disable-next-line no-var
            var elem, xVal, yVal;

            if (params.selector) {
                elem = document.querySelector(params.selector);

                if (!elem) {
                    throw new Error(
                        "Scroll screenshot failed with: " +
                            'Could not find element with css selector specified in "selectorToScroll" option: ' +
                            params.selector,
                    );
                }

                xVal = elem.scrollLeft + params.x;
                yVal = elem.scrollTop + params.y;
            } else {
                elem = window;
                xVal = window.pageXOffset + params.x;
                yVal = window.pageYOffset + params.y;
            }

            return elem.scrollTo(xVal, yVal);
        }, params);
    }

    protected async _attachSession({ sessionId, sessionCaps, sessionOpts = {capabilities: {}} }: SessionOptions): Promise<WebdriverIO.Browser> {
        const detectedSessionEnvFlags = sessionEnvironmentDetector({
            capabilities: sessionCaps!,
            requestedCapabilities: sessionOpts.capabilities,
        });

        const opts: AttachOptions = {
            sessionId,
            ...sessionOpts,
            ...this._getSessionOptsFromConfig(OPTIONAL_SESSION_OPTS),
            ...detectedSessionEnvFlags,
            ...this._config.sessionEnvFlags,
            options: sessionOpts,
            capabilities: { ...sessionOpts.capabilities, ...sessionCaps },
            requestedCapabilities: sessionOpts.capabilities,
        };

        return attach(opts);
    }

    protected _initMeta(): Record<string, unknown> {
        return {
            pid: process.pid,
            browserVersion: this.version,
            testXReqId: this.state.testXReqId,
            traceparent: this.state.traceparent,
            ...this._config.meta,
        };
    }

    protected _takeScreenshot(): Promise<string> {
        ensure(this._session, BROWSER_SESSION_HINT);
        return this._session.takeScreenshot();
    }

    protected _addCommands(): void {
        ensure(this._session, BROWSER_SESSION_HINT);
        this._addMetaAccessCommands(this._session);
        this._decorateUrlMethod(this._session);
        // The reason for doing this is that in webdriverio 8.26.2 there was a breaking change that made ElementsList an async iterator
        // https://github.com/webdriverio/webdriverio/pull/11874
        this._overrideGetElementsList(this._session);

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        customCommandFileNames.forEach(command => require(`./commands/${command}`).default(this));

        super._addCommands();
    }

    protected _overrideGetElementsList(session: WebdriverIO.Browser): void {
        for (const attachToElement of [false, true]) {
            // @ts-expect-error This is a temporary hack to patch wdio's breaking changes.
            session.overwriteCommand("$$", async (origCommand, selector): ChainablePromiseArray<ElementArray> => {
                const arr: WebdriverIO.Element[] & {parent?: unknown; foundWith?: unknown; selector?: unknown} = [];
                const res = await origCommand(selector);
                for await (const el of res) arr.push(el);
                arr.parent = res.parent;
                arr.foundWith = res.foundWith;
                arr.selector = res.selector;

                return arr as unknown as ChainablePromiseArray<ElementArray>;
            }, attachToElement);
        }
    }

    protected _addMetaAccessCommands(session: WebdriverIO.Browser): void {
        session.addCommand("setMeta", (key, value) => (this._meta[key] = value));
        session.addCommand("getMeta", key => (key ? this._meta[key] : this._meta));
    }

    protected _decorateUrlMethod(session: WebdriverIO.Browser): void {
        session.overwriteCommand("url", async (origUrlFn, uri) => {
            if (!uri) {
                return session.getUrl();
            }

            const newUri = this._resolveUrl(uri);
            this._meta.url = newUri;

            if (this._config.urlHttpTimeout) {
                this.setHttpTimeout(this._config.urlHttpTimeout);
            }

            const result = await origUrlFn(newUri);

            if (this._config.urlHttpTimeout) {
                this.restoreHttpTimeout();
            }

            if (this._clientBridge) {
                await this._clientBridge.call("resetZoom");
            }

            return result;
        });
    }

    protected _resolveUrl(uri: string): string {
        return this._config.baseUrl ? url.resolve(this._config.baseUrl, uri) : uri;
    }

    protected async _performIsolation({ sessionCaps, sessionOpts }: Pick<SessionOptions, "sessionCaps" | "sessionOpts">): Promise<void> {
        ensure(this._session, BROWSER_SESSION_HINT);
        if (!this._config.isolation) {
            return;
        }

        const { browserName, browserVersion = "", version = "" } = sessionCaps as SessionOptions['sessionCaps'] & {version?: string;} || {};
        if (!isSupportIsolation(browserName!, browserVersion)) {
            logger.warn(
                `WARN: test isolation works only with chrome@${MIN_CHROME_VERSION_SUPPORT_ISOLATION} and higher, ` +
                `but got ${browserName}@${browserVersion || version}`,
            );
            return;
        }

        const puppeteer = await this._session.getPuppeteer();
        const browserCtxs = puppeteer.browserContexts();

        const incognitoCtx = await puppeteer.createIncognitoBrowserContext();
        const page = await incognitoCtx.newPage();

        if (sessionOpts?.automationProtocol === WEBDRIVER_PROTOCOL) {
            const windowIds = await this._session.getWindowHandles();
            const incognitoWindowId = windowIds.find(id => id.includes(page.target()._targetId));

            await this._session.switchToWindow(incognitoWindowId!);
        }

        for (const ctx of browserCtxs) {
            if (ctx.isIncognito()) {
                await ctx.close();
                continue;
            }

            for (const page of await ctx.pages()) {
                await page.close();
            }
        }
    }

    protected async _prepareSession(): Promise<void> {
        await this._setOrientation(this.config.orientation);
        await this._setWindowSize(this.config.windowSize);
    }

    protected async _setOrientation(orientation: string | null): Promise<void> {
        if (orientation) {
            ensure(this._session, BROWSER_SESSION_HINT);
            await this._session.setOrientation(orientation);
        }
    }

    protected async _setWindowSize(size: {width: number; height: number} | null): Promise<void> {
        if (size) {
            ensure(this._session, BROWSER_SESSION_HINT);
            await this._session.setWindowSize(size.width, size.height);
        }
    }

    protected async _performCalibration(calibrator: Calibrator): Promise<void> {
        if (!this.config.calibrate || this._calibration) {
            return Promise.resolve();
        }

        return calibrator.calibrate(this).then(calibration => {
            this._calibration = calibration;
            this._camera.calibrate(calibration);
        });
    }

    protected async _buildClientScripts(): Promise<ClientBridge> {
        return buildClientBridge(this, { calibration: this._calibration })
            .then(clientBridge => (this._clientBridge = clientBridge));
    }

    protected async _runInEachIframe(cb: (...args: unknown[]) => unknown): Promise<void> {
        ensure(this._session, BROWSER_SESSION_HINT);
        const iframes = await this._session.findElements("css selector", "iframe");

        try {
            for (const iframe of iframes) {
                await this._session.switchToFrame(iframe);
                await cb();
                // switchToParentFrame does not work in ios - https://github.com/appium/appium/issues/14882
                await this._session.switchToFrame(null);
            }
        } catch (e) {
            await this._session.switchToFrame(null);
            throw e;
        }
    }

    protected async _disableFrameAnimations(): Promise<void> {
        ensure(this._clientBridge, CLIENT_BRIDGE_HINT);
        const result = await this._clientBridge.call<void>("disableFrameAnimations");

        if (isClientBridgeErrorData(result)) {
            throw new Error(
                `Disable animations failed with error type '${result.error}' and error message: ${result.message}`,
            );
        }

        return result;
    }

    protected async _disableIframeAnimations(): Promise<void> {
        await this._runInEachIframe(() => this._disableFrameAnimations());
    }

    protected async _cleanupFrameAnimations(): Promise<void> {
        ensure(this._clientBridge, CLIENT_BRIDGE_HINT);

        return this._clientBridge.call("cleanupFrameAnimations");
    }

    protected async _cleanupIframeAnimations(): Promise<void> {
        await this._runInEachIframe(() => this._cleanupFrameAnimations());
    }

    protected async _cleanupPageAnimations(): Promise<void> {
        await this._cleanupFrameAnimations();

        if (this._config.automationProtocol === WEBDRIVER_PROTOCOL) {
            await this._cleanupIframeAnimations();
        }
    }

    _stubCommands(): void {
        if (!this._session) {
            return;
        }

        for (const commandName of this._session.commandList) {
            if (commandName === "deleteSession") {
                continue;
            }

            if (_.isFunction(this._session[commandName as keyof WebdriverIO.Browser])) {
                this._session.overwriteCommand(commandName as WebdriverIO.BrowserCommand, () => {});
            }
        }
    }

    get meta(): Record<string, unknown> {
        return this._meta;
    }
}
