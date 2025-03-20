"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExistingBrowser = void 0;
const url_1 = __importDefault(require("url"));
const lodash_1 = __importDefault(require("lodash"));
const webdriverio_1 = require("@testplane/webdriverio");
const wdio_utils_1 = require("@testplane/wdio-utils");
const browser_1 = require("./browser");
const commands_1 = require("./commands");
const camera_1 = require("./camera");
const client_bridge_1 = require("./client-bridge");
const history = __importStar(require("./history"));
const logger = __importStar(require("../utils/logger"));
const config_1 = require("../constants/config");
const browser_2 = require("../constants/browser");
const browser_3 = require("../utils/browser");
const config_2 = require("../utils/config");
const help_1 = require("../constants/help");
const OPTIONAL_SESSION_OPTS = ["transformRequest", "transformResponse"];
const BROWSER_SESSION_HINT = "browser session";
const CLIENT_BRIDGE_HINT = "client bridge";
function ensure(value, hint) {
    if (!value) {
        throw new Error(`Execution can't proceed, because a crucial component was not initialized${hint ? " (" + hint + ")" : ""}. This is likely due to a bug on our side.\n` +
            `\nPlease file an issue at ${help_1.NEW_ISSUE_LINK}, we will try to fix it as soon as possible.`);
    }
}
const isClientBridgeErrorData = (data) => {
    return Boolean(data && data.error && data.message);
};
class ExistingBrowser extends browser_1.Browser {
    constructor(config, opts) {
        super(config, opts);
        this._camera = camera_1.Camera.create(this._config.screenshotMode, () => this._takeScreenshot());
        this._meta = this._initMeta();
    }
    async init({ sessionId, sessionCaps, sessionOpts }, calibrator) {
        this._session = await this._attachSession({ sessionId, sessionCaps, sessionOpts });
        if (!(0, config_2.isRunInNodeJsEnv)(this._config)) {
            this._startCollectingCustomCommands();
        }
        this._extendStacktrace();
        this._addSteps();
        // this._addHistory();
        await history.runGroup(this._callstackHistory, "testplane: init browser", async () => {
            this._addCommands();
            await this._performIsolation({ sessionCaps, sessionOpts });
            try {
                this.config.prepareBrowser && this.config.prepareBrowser(this.publicAPI);
            }
            catch (e) {
                logger.warn(`WARN: couldn't prepare browser ${this.id}\n`, e?.stack);
            }
            await this._prepareSession();
            await this._performCalibration(calibrator);
            await this._buildClientScripts();
        });
        return this;
    }
    markAsBroken() {
        if (this.state.isBroken) {
            return;
        }
        this.applyState({ isBroken: true });
        this._stubCommands();
    }
    quit() {
        this._meta = this._initMeta();
    }
    async prepareScreenshot(selectors, opts = {}) {
        opts = lodash_1.default.extend(opts, {
            usePixelRatio: this._calibration ? this._calibration.usePixelRatio : true,
        });
        ensure(this._clientBridge, CLIENT_BRIDGE_HINT);
        const result = await this._clientBridge.call("prepareScreenshot", [selectors, opts]);
        if (isClientBridgeErrorData(result)) {
            throw new Error(`Prepare screenshot failed with error type '${result.error}' and error message: ${result.message}`);
        }
        // https://github.com/webdriverio/webdriverio/issues/11396
        if (this._config.automationProtocol === config_1.WEBDRIVER_PROTOCOL && opts.disableAnimation) {
            await this._disableIframeAnimations();
        }
        return result;
    }
    async cleanupScreenshot(opts = {}) {
        if (opts.disableAnimation) {
            await this._cleanupPageAnimations();
        }
    }
    open(url) {
        ensure(this._session, BROWSER_SESSION_HINT);
        return this._session.url(url);
    }
    evalScript(script) {
        ensure(this._session, BROWSER_SESSION_HINT);
        return this._session.execute(`return ${script}`);
    }
    injectScript(script) {
        ensure(this._session, BROWSER_SESSION_HINT);
        return this._session.execute(script);
    }
    async captureViewportImage(page, screenshotDelay) {
        if (screenshotDelay) {
            await new Promise(resolve => setTimeout(resolve, screenshotDelay));
        }
        return this._camera.captureViewportImage(page);
    }
    scrollBy(params) {
        ensure(this._session, BROWSER_SESSION_HINT);
        return this._session.execute(function (params) {
            // eslint-disable-next-line no-var
            var elem, xVal, yVal;
            if (params.selector) {
                elem = document.querySelector(params.selector);
                if (!elem) {
                    throw new Error("Scroll screenshot failed with: " +
                        'Could not find element with css selector specified in "selectorToScroll" option: ' +
                        params.selector);
                }
                xVal = elem.scrollLeft + params.x;
                yVal = elem.scrollTop + params.y;
            }
            else {
                elem = window;
                xVal = window.pageXOffset + params.x;
                yVal = window.pageYOffset + params.y;
            }
            return elem.scrollTo(xVal, yVal);
        }, params);
    }
    async _attachSession({ sessionId, sessionCaps, sessionOpts = { capabilities: {} }, }) {
        const detectedSessionEnvFlags = (0, wdio_utils_1.sessionEnvironmentDetector)({
            capabilities: sessionCaps,
            requestedCapabilities: sessionOpts.capabilities,
        });
        const opts = {
            sessionId,
            ...sessionOpts,
            ...this._getSessionOptsFromConfig(OPTIONAL_SESSION_OPTS),
            ...detectedSessionEnvFlags,
            ...this._config.sessionEnvFlags,
            options: sessionOpts,
            capabilities: { ...sessionOpts.capabilities, ...sessionCaps },
            requestedCapabilities: sessionOpts.capabilities,
        };
        return (0, webdriverio_1.attach)(opts);
    }
    _initMeta() {
        return {
            pid: process.pid,
            browserVersion: this.version,
            testXReqId: this.state.testXReqId,
            traceparent: this.state.traceparent,
            ...this._config.meta,
        };
    }
    _takeScreenshot() {
        ensure(this._session, BROWSER_SESSION_HINT);
        return this._session.takeScreenshot();
    }
    _addCommands() {
        ensure(this._session, BROWSER_SESSION_HINT);
        this._addMetaAccessCommands(this._session);
        this._decorateUrlMethod(this._session);
        // The reason for doing this is that in webdriverio 8.26.2 there was a breaking change that made ElementsList an async iterator
        // https://github.com/webdriverio/webdriverio/pull/11874
        this._overrideGetElementsList(this._session);
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        commands_1.customCommandFileNames.forEach(command => require(`./commands/${command}`).default(this));
        super._addCommands();
    }
    _overrideGetElementsList(session) {
        // prettier-ignore
        for (const attachToElement of [false, true]) {
            // @ts-expect-error This is a temporary hack to patch wdio's breaking changes.
            session.overwriteCommand("$$", async (origCommand, selector) => {
                const arr = [];
                const res = await origCommand(selector);
                for await (const el of res)
                    arr.push(el);
                arr.parent = res.parent;
                arr.foundWith = res.foundWith;
                arr.selector = res.selector;
                arr.props = res.props;
                return arr;
            }, attachToElement);
        }
    }
    _addMetaAccessCommands(session) {
        session.addCommand("setMeta", (key, value) => (this._meta[key] = value));
        session.addCommand("getMeta", key => (key ? this._meta[key] : this._meta));
    }
    _decorateUrlMethod(session) {
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
    _resolveUrl(uri) {
        return this._config.baseUrl ? url_1.default.resolve(this._config.baseUrl, uri) : uri;
    }
    async _performIsolation({ sessionCaps, sessionOpts, }) {
        ensure(this._session, BROWSER_SESSION_HINT);
        if (!this._config.isolation) {
            return;
        }
        console.log('PERFORM ISOLATION');
        const { browserName, browserVersion = "", version = "", } = sessionCaps || {};
        if (!(0, browser_3.isSupportIsolation)(browserName, browserVersion)) {
            logger.warn(`WARN: test isolation works only with chrome@${browser_2.MIN_CHROME_VERSION_SUPPORT_ISOLATION} and higher, ` +
                `but got ${browserName}@${browserVersion || version}`);
            return;
        }
        const puppeteer = await this._session.getPuppeteer();
        console.log('getPuppeteer res:', puppeteer);
        const browserCtxs = puppeteer.browserContexts();
        console.log('browserCtxs:', browserCtxs);
        const incognitoCtx = await puppeteer.createBrowserContext();
        // const incognitoCtx = await (puppeteer as any).createBrowserContext();
        const page = await incognitoCtx.newPage();
        if (sessionOpts?.automationProtocol === config_1.WEBDRIVER_PROTOCOL) {
            const windowIds = await this._session.getWindowHandles();
            console.log('windowIds:', windowIds);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const incognitoWindowId = windowIds.find(id => id.includes(page.target()._targetId));
            console.log('incognitoWindowId:', incognitoWindowId);
            await this._session.switchToWindow(incognitoWindowId);
            // await this._session.pause(2000);
            // await this._session.url('https://testplane.io');
        }
        // for (const ctx of browserCtxs) {
        //     if (ctx.isIncognito()) {
        //         await ctx.close();
        //         continue;
        //     }
        //     for (const page of await ctx.pages()) {
        //         await page.close();
        //     }
        // }
    }
    async _prepareSession() {
        await this._setOrientation(this.config.orientation);
        await this._setWindowSize(this.config.windowSize);
    }
    async _setOrientation(orientation) {
        if (orientation) {
            ensure(this._session, BROWSER_SESSION_HINT);
            await this._session.setOrientation(orientation);
        }
    }
    async _setWindowSize(size) {
        if (size) {
            ensure(this._session, BROWSER_SESSION_HINT);
            await this._session.setWindowSize(size.width, size.height);
        }
    }
    async _performCalibration(calibrator) {
        if (!this.config.calibrate || this._calibration) {
            return Promise.resolve();
        }
        return calibrator.calibrate(this).then(calibration => {
            this._calibration = calibration;
            this._camera.calibrate(calibration);
        });
    }
    async _buildClientScripts() {
        return (0, client_bridge_1.build)(this, { calibration: this._calibration }).then(clientBridge => (this._clientBridge = clientBridge));
    }
    async _runInEachIframe(cb) {
        ensure(this._session, BROWSER_SESSION_HINT);
        const iframes = await this._session.findElements("css selector", "iframe");
        try {
            for (const iframe of iframes) {
                await this._session.switchToFrame(iframe);
                await cb();
                // switchToParentFrame does not work in ios - https://github.com/appium/appium/issues/14882
                await this._session.switchToFrame(null);
            }
        }
        catch (e) {
            await this._session.switchToFrame(null);
            throw e;
        }
    }
    async _disableFrameAnimations() {
        ensure(this._clientBridge, CLIENT_BRIDGE_HINT);
        const result = await this._clientBridge.call("disableFrameAnimations");
        if (isClientBridgeErrorData(result)) {
            throw new Error(`Disable animations failed with error type '${result.error}' and error message: ${result.message}`);
        }
        return result;
    }
    async _disableIframeAnimations() {
        await this._runInEachIframe(() => this._disableFrameAnimations());
    }
    async _cleanupFrameAnimations() {
        ensure(this._clientBridge, CLIENT_BRIDGE_HINT);
        return this._clientBridge.call("cleanupFrameAnimations");
    }
    async _cleanupIframeAnimations() {
        await this._runInEachIframe(() => this._cleanupFrameAnimations());
    }
    async _cleanupPageAnimations() {
        await this._cleanupFrameAnimations();
        if (this._config.automationProtocol === config_1.WEBDRIVER_PROTOCOL) {
            await this._cleanupIframeAnimations();
        }
    }
    _stubCommands() {
        if (!this._session) {
            return;
        }
        for (const commandName of this._session.commandList) {
            if (commandName === "deleteSession") {
                continue;
            }
            if (lodash_1.default.isFunction(this._session[commandName])) {
                this._session.overwriteCommand(commandName, () => { });
            }
        }
    }
    get meta() {
        return this._meta;
    }
}
exports.ExistingBrowser = ExistingBrowser;
//# sourceMappingURL=existing-browser.js.map