import url from "url";
import _ from "lodash";
import { parse as parseCookiesString, Cookie } from "set-cookie-parser";
import { attach, type AttachOptions, type ElementArray } from "@testplane/webdriverio";
import { sessionEnvironmentDetector } from "@testplane/wdio-utils";
import { Browser, BrowserOpts } from "./browser";
import { customCommandFileNames } from "./commands";
import { Camera, PageMeta } from "./camera";
import { type ClientBridge, build as buildClientBridge } from "./client-bridge";
import * as history from "./history";
import * as logger from "../utils/logger";
import { DEVTOOLS_PROTOCOL, WEBDRIVER_PROTOCOL } from "../constants/config";
import { MIN_CHROME_VERSION_SUPPORT_ISOLATION } from "../constants/browser";
import { isSupportIsolation } from "../utils/browser";
import { isRunInNodeJsEnv } from "../utils/config";
import { Config } from "../config";
import { Image, Rect } from "../image";
import type { CalibrationResult, Calibrator } from "./calibrator";
import { NEW_ISSUE_LINK } from "../constants/help";
import { runWithoutHistory } from "./history";
import type { SessionOptions } from "./types";
import { Protocol } from "devtools-protocol";
import { getCalculatedProtocol } from "./commands/saveState";
import { Page } from "puppeteer-core";
import { CDP } from "./cdp";
import type { ElementReference } from "@testplane/wdio-protocols";

const OPTIONAL_SESSION_OPTS = ["transformRequest", "transformResponse"];

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
const CDP_CONNECTION_HINT = "cdp connection";
const CLIENT_BRIDGE_HINT = "client bridge";

function ensure<T>(value: T | undefined | null, hint?: string): asserts value is T {
    if (!value) {
        throw new Error(
            `Execution can't proceed, because a crucial component was not initialized${
                hint ? " (" + hint + ")" : ""
            }. This is likely due to a bug on our side.\n` +
                `\nPlease file an issue at ${NEW_ISSUE_LINK}, we will try to fix it as soon as possible.`,
        );
    }
}

const isClientBridgeErrorData = (data: unknown): data is ClientBridgeErrorData => {
    return Boolean(data && (data as ClientBridgeErrorData).error && (data as ClientBridgeErrorData).message);
};

export const getActivePuppeteerPage = async (session: WebdriverIO.Browser): Promise<Page | undefined> => {
    const puppeteer = await session.getPuppeteer();

    if (!puppeteer) {
        return;
    }

    const pages = await puppeteer.pages();

    if (!pages.length) {
        return;
    }

    const active = await session.getWindowHandle();

    for (const page of pages) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error need private _targetId
        if (page.target()._targetId === active) {
            return page;
        }
    }

    return pages[pages.length - 1];
};

export class ExistingBrowser extends Browser {
    protected _camera: Camera;
    protected _meta: Record<string, unknown>;
    protected _calibration?: CalibrationResult;
    protected _clientBridge?: ClientBridge;
    protected _cdp: CDP | null = null;
    private _allCookies: Map<string, Protocol.Network.CookieParam> = new Map();

    constructor(config: Config, opts: BrowserOpts) {
        super(config, opts);

        this._camera = Camera.create(this._config.screenshotMode, () => this._takeScreenshot());

        this._meta = this._initMeta();
    }

    async init({ sessionId, sessionCaps, sessionOpts }: SessionOptions, calibrator: Calibrator): Promise<this> {
        this._session = await this._attachSession({ sessionId, sessionCaps, sessionOpts });

        const cdpPromise = CDP.create(this).then(cdp => {
            this._cdp = cdp;
        });

        if (!isRunInNodeJsEnv(this._config)) {
            this._startCollectingCustomCommands();
        }

        const isolationPromise = cdpPromise.then(() => this._performIsolation({ sessionCaps, sessionOpts }));

        this._extendStacktrace();
        this._addSteps();
        this._addHistory();

        await history.runGroup(
            {
                session: this._session,
                snapshotsPromiseRef: this._snapshotsPromiseRef,
                callstack: this._callstackHistory!,
                config: this._config,
            },
            "testplane: init browser",
            async () => {
                this._addCommands();

                await isolationPromise;

                if (getCalculatedProtocol(this) === DEVTOOLS_PROTOCOL) {
                    await this.startCollectCookies();
                }

                this._callstackHistory?.clear();

                try {
                    this.config.prepareBrowser && this.config.prepareBrowser(this.publicAPI);
                } catch (e: unknown) {
                    logger.warn(`WARN: couldn't prepare browser ${this.id}\n`, (e as Error)?.stack);
                }

                await this._prepareSession();
                await this._performCalibration(calibrator);
                await this._buildClientScripts();
            },
        );

        return this;
    }

    getCookieIndex(cookie: Cookie): string {
        return [cookie.name, cookie.domain, cookie.path].join("-");
    }

    async getAllRequestsCookies(): Promise<Array<Protocol.Network.CookieParam>> {
        if (this._session) {
            const cookies = await this._session.getAllCookies();

            if (cookies) {
                cookies.forEach(cookie => {
                    this._allCookies.set(this.getCookieIndex(cookie), cookie as Protocol.Network.CookieParam);
                });
            }
        }

        return [...this._allCookies.values()].map(cookie => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            expires: cookie.expires ? cookie.expires : undefined,
            httpOnly: cookie.httpOnly,
            secure: cookie.secure,
            sameSite: cookie.sameSite,
        }));
    }

    async startCollectCookies(): Promise<void> {
        if (!this._session) {
            return;
        }

        this._allCookies = new Map();

        const page = await getActivePuppeteerPage(this._session);

        if (!page) {
            return;
        }

        page.on("response", async res => {
            try {
                const headers = res.headers();

                if (headers["set-cookie"]) {
                    headers["set-cookie"].split("\n").forEach(str => {
                        parseCookiesString(str, { map: false }).forEach((cookie: Cookie) => {
                            const index = this.getCookieIndex(cookie);
                            const expires = cookie.expires
                                ? Math.floor(new Date(cookie.expires).getTime() / 1000)
                                : undefined;

                            this._allCookies.set(index, {
                                ...cookie,
                                domain: cookie.domain ?? new URL(res.url()).hostname,
                                expires,
                            } as Protocol.Network.CookieParam);
                        });
                    });
                }
            } catch (err) {
                console.error(err);
            }
        });
    }

    markAsBroken(): void {
        if (this.state.isBroken) {
            return;
        }

        this.applyState({ isBroken: true });

        this._stubCommands();
    }

    quit(): void {
        this._cdp?.close();
        this._meta = this._initMeta();
    }

    async prepareScreenshot(selectors: string[] | Rect[], opts: PrepareScreenshotOpts = {}): Promise<unknown> {
        // Running this fragment with history causes rrweb snapshots to break on pages with iframes
        return runWithoutHistory({ callstack: this._callstackHistory! }, async () => {
            opts = _.extend(opts, {
                usePixelRatio: this._calibration ? this._calibration.usePixelRatio : true,
            });

            ensure(this._clientBridge, CLIENT_BRIDGE_HINT);
            const result = await this._clientBridge.call("prepareScreenshot", [selectors, opts]);
            if (isClientBridgeErrorData(result)) {
                throw new Error(
                    `Prepare screenshot failed with error type '${result.error}' and error message: ${result.message}`,
                );
            }

            // https://github.com/webdriverio/webdriverio/issues/11396
            if (this._config.automationProtocol === WEBDRIVER_PROTOCOL && opts.disableAnimation) {
                await this._disableIframeAnimations();
            }

            return result;
        });
    }

    async cleanupScreenshot(opts: { disableAnimation?: boolean } = {}): Promise<void> {
        if (opts.disableAnimation) {
            return runWithoutHistory({ callstack: this._callstackHistory! }, async () => {
                await this._cleanupPageAnimations();
            });
        }
    }

    open(url: string): Promise<WebdriverIO.Request | string | void> {
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
            await new Promise(resolve => setTimeout(resolve, screenshotDelay));
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

    protected async _attachSession({
        sessionId,
        sessionCaps,
        sessionOpts = { capabilities: {} },
    }: SessionOptions): Promise<WebdriverIO.Browser> {
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
        // prettier-ignore
        for (const attachToElement of [false, true]) {
            // @ts-expect-error This is a temporary hack to patch wdio's breaking changes.
            session.overwriteCommand("$$", async (origCommand, selector): Promise<WebdriverIO.ElementArray> => {
                    const arr: WebdriverIO.Element[] & Partial<Pick<ElementArray, "parent" | "foundWith" | "selector" | "props">> = [];
                    const res = await origCommand(selector) as unknown as WebdriverIO.ElementArray;

                    for await (const el of res) arr.push(el);

                    arr.parent = res.parent;
                    arr.foundWith = res.foundWith;
                    arr.selector = res.selector;
                    arr.props = res.props;

                    return arr as unknown as WebdriverIO.ElementArray;
                },
                attachToElement,
            );
        }
    }

    protected _addMetaAccessCommands(session: WebdriverIO.Browser): void {
        session.addCommand("setMeta", (key, value) => (this._meta[key] = value));
        session.addCommand("getMeta", key => (key ? this._meta[key] : this._meta));
    }

    protected _decorateUrlMethod(session: WebdriverIO.Browser): void {
        session.overwriteCommand("url", async (origUrlFn, uri): Promise<void | string | WebdriverIO.Request> => {
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

    protected async _performBidiIsolation(sessionOpts: SessionOptions["sessionOpts"]): Promise<void> {
        ensure(this._session, BROWSER_SESSION_HINT);

        const puppeteer = await this._session.getPuppeteer();
        const browserCtxs = puppeteer.browserContexts();

        const incognitoCtx = await puppeteer.createIncognitoBrowserContext();
        const page = await incognitoCtx.newPage();

        if (sessionOpts?.automationProtocol === WEBDRIVER_PROTOCOL) {
            const windowIds = await this._session.getWindowHandles();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const incognitoWindowId = windowIds.find(id => id.includes((page.target() as any)._targetId));

            await Promise.all([this._session.switchToWindow(incognitoWindowId!), page.bringToFront()]);
        }

        if (this._session.isBidi) {
            return;
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

    protected async _performCdpIsolation(sessionOpts: SessionOptions["sessionOpts"]): Promise<void> {
        ensure(this._session, BROWSER_SESSION_HINT);
        ensure(this._cdp, CDP_CONNECTION_HINT);

        const session = this._session;
        const cdpTarget = this._cdp.target;
        const [browserContextIds, currentTargets, browserContextId] = await Promise.all([
            cdpTarget.getBrowserContexts().then(res => res.browserContextIds),
            cdpTarget.getTargets().then(res => res.targetInfos),
            cdpTarget.createBrowserContext().then(res => res.browserContextId),
        ]);
        const incognitoWindowId = await cdpTarget.createTarget({ browserContextId }).then(res => res.targetId);

        const switchWindowPromise =
            sessionOpts?.automationProtocol === WEBDRIVER_PROTOCOL
                ? session
                      .getWindowHandles()
                      .then(ids => session.switchToWindow(ids.find(id => id.includes(incognitoWindowId)) as string))
                : null;

        const browserContextIdsToClose = browserContextIds.filter(id => id !== browserContextId);

        await Promise.all([
            switchWindowPromise,
            cdpTarget.activateTarget(incognitoWindowId),
            ...browserContextIdsToClose.map(contextId => cdpTarget.disposeBrowserContext(contextId)),
            ...currentTargets.map(target => cdpTarget.closeTarget(target.targetId).catch(() => {})),
        ]);
    }

    protected async _performIsolation({
        sessionCaps,
        sessionOpts,
    }: Pick<SessionOptions, "sessionCaps" | "sessionOpts">): Promise<void> {
        ensure(this._session, BROWSER_SESSION_HINT);
        if (!this._config.isolation) {
            return;
        }

        const {
            browserName,
            browserVersion = "",
            version = "",
        } = (sessionCaps as SessionOptions["sessionCaps"] & { version?: string }) || {};
        if (!isSupportIsolation(browserName!, browserVersion)) {
            logger.warn(
                `WARN: test isolation works only with chrome@${MIN_CHROME_VERSION_SUPPORT_ISOLATION} and higher, ` +
                    `but got ${browserName}@${browserVersion || version}`,
            );
            return;
        }

        if (this._session.isBidi) {
            return this._performBidiIsolation(sessionOpts);
        } else if (this._cdp) {
            return this._performCdpIsolation(sessionOpts);
        } else {
            logger.warn("Unable to get CDP endpoint, skip performing isolation");
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

    protected async _setWindowSize(
        size: { width: number; height: number } | `${number}x${number}` | null,
    ): Promise<void> {
        if (size) {
            ensure(this._session, BROWSER_SESSION_HINT);

            if (typeof size === "string") {
                const [width, height] = size.split("x").map(v => parseInt(v, 10));
                await this._session.setWindowSize(width, height);
            } else {
                await this._session.setWindowSize(size.width, size.height);
            }
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
        return buildClientBridge(this, { calibration: this._calibration }).then(
            clientBridge => (this._clientBridge = clientBridge),
        );
    }

    protected async _runInEachDisplayedIframe(cb: (...args: unknown[]) => unknown): Promise<void> {
        ensure(this._session, BROWSER_SESSION_HINT);
        const session = this._session;
        const iframes = await session.findElements("css selector", "iframe[src]");
        const displayedIframes: ElementReference[] = [];

        await Promise.all(
            iframes.map(async iframe => {
                const isIframeDisplayed = await session.$(iframe).isDisplayed();

                if (isIframeDisplayed) {
                    displayedIframes.push(iframe);
                }
            }),
        );

        try {
            for (const iframe of displayedIframes) {
                await session.switchToFrame(iframe);
                await cb();
                // switchToParentFrame does not work in ios - https://github.com/appium/appium/issues/14882
                await session.switchToFrame(null);
            }
        } catch (e) {
            await session.switchToFrame(null);
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
        await this._runInEachDisplayedIframe(() => this._disableFrameAnimations());
    }

    protected async _cleanupFrameAnimations(): Promise<void> {
        ensure(this._clientBridge, CLIENT_BRIDGE_HINT);

        return this._clientBridge.call("cleanupFrameAnimations");
    }

    protected async _cleanupIframeAnimations(): Promise<void> {
        await this._runInEachDisplayedIframe(() => this._cleanupFrameAnimations());
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

    get cdp(): CDP | null {
        return this._cdp;
    }
}
