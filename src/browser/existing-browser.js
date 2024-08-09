/* global window, document */
"use strict";

const url = require("url");
const Promise = require("bluebird");
const _ = require("lodash");
const webdriverio = require("webdriverio");
const { sessionEnvironmentDetector } = require("@wdio/utils-cjs");
const Browser = require("./browser").default;
const commandsList = require("./commands");
const Camera = require("./camera");
const clientBridge = require("./client-bridge");
const history = require("./history");
const logger = require("../utils/logger");
const { WEBDRIVER_PROTOCOL } = require("../constants/config");
const { MIN_CHROME_VERSION_SUPPORT_ISOLATION } = require("../constants/browser");
const { isSupportIsolation } = require("../utils/browser");
const { isRunInNodeJsEnv } = require("../utils/config");

const OPTIONAL_SESSION_OPTS = ["transformRequest", "transformResponse"];

module.exports = class ExistingBrowser extends Browser {
    static create(config, opts) {
        return new this(config, opts);
    }

    constructor(config, opts) {
        super(config, opts);

        this._emitter = opts.emitter;
        this._camera = Camera.create(this._config.screenshotMode, () => this._takeScreenshot());

        this._meta = this._initMeta();
    }

    async init({ sessionId, sessionCaps, sessionOpts } = {}, calibrator) {
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
            } catch (e) {
                logger.warn(`WARN: couldn't prepare browser ${this.id}\n`, e.stack);
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
        opts = _.extend(opts, {
            usePixelRatio: this._calibration ? this._calibration.usePixelRatio : true,
        });

        const result = await this._clientBridge.call("prepareScreenshot", [selectors, opts]);
        if (result.error) {
            throw new Error(
                `Prepare screenshot failed with error type '${result.error}' and error message: ${result.message}`,
            );
        }

        // https://github.com/webdriverio/webdriverio/issues/11396
        if (this._config.automationProtocol === "webdriver" && opts.disableAnimation) {
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
        return this._session.url(url);
    }

    evalScript(script) {
        return this._session.execute(`return ${script}`);
    }

    injectScript(script) {
        return this._session.execute(script);
    }

    async captureViewportImage(page, screenshotDelay) {
        if (screenshotDelay) {
            await Promise.delay(screenshotDelay);
        }

        return this._camera.captureViewportImage(page);
    }

    scrollBy(params) {
        return this._session.execute(function (params) {
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

    _attachSession({ sessionId, sessionCaps, sessionOpts = {} }) {
        const detectedSessionEnvFlags = sessionEnvironmentDetector({
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

        return webdriverio.attach(opts);
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
        return this._session.takeScreenshot();
    }

    _addCommands() {
        this._addMetaAccessCommands(this._session);
        this._decorateUrlMethod(this._session);
        // The reason for doing this is that in webdriverio 8.26.2 there was a breaking change that made ElementsList an async iterator
        // https://github.com/webdriverio/webdriverio/pull/11874
        this._overrideGetElementsList(this._session);

        commandsList.forEach(command => require(`./commands/${command}`).default(this));

        super._addCommands();
    }

    _overrideGetElementsList(session) {
        session.overwriteCommand("$$", async (origCommand, selector) => {
            const arr = [];
            const res = await origCommand(selector);
            for await (const el of res) arr.push(el);
            arr.parent = res.parent;
            arr.foundWith = res.foundWith;
            arr.selector = res.selector;
            return arr;
        });
        session.overwriteCommand(
            "$$",
            async (origCommand, selector) => {
                const arr = [];
                const res = await origCommand(selector);
                for await (const el of res) arr.push(el);
                arr.parent = res.parent;
                arr.foundWith = res.foundWith;
                arr.selector = res.selector;
                return arr;
            },
            true,
        );
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
        return this._config.baseUrl ? url.resolve(this._config.baseUrl, uri) : uri;
    }

    async _performIsolation({ sessionCaps, sessionOpts }) {
        if (!this._config.isolation) {
            return;
        }

        const { browserName, browserVersion = "", version = "" } = sessionCaps;
        const { automationProtocol } = sessionOpts;

        if (!isSupportIsolation(browserName, browserVersion)) {
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

        if (automationProtocol === WEBDRIVER_PROTOCOL) {
            const windowIds = await this._session.getWindowHandles();
            const incognitoWindowId = windowIds.find(id => id.includes(page.target()._targetId));

            await this._session.switchToWindow(incognitoWindowId);
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

    async _prepareSession() {
        await this._setOrientation(this.config.orientation);
        await this._setWindowSize(this.config.windowSize);
    }

    async _setOrientation(orientation) {
        if (orientation) {
            await this._session.setOrientation(orientation);
        }
    }

    async _setWindowSize(size) {
        if (size) {
            await this._session.setWindowSize(size.width, size.height);
        }
    }

    _performCalibration(calibrator) {
        if (!this.config.calibrate || this._calibration) {
            return Promise.resolve();
        }

        return calibrator.calibrate(this).then(calibration => {
            this._calibration = calibration;
            this._camera.calibrate(calibration);
        });
    }

    _buildClientScripts() {
        return clientBridge
            .build(this, { calibration: this._calibration })
            .then(clientBridge => (this._clientBridge = clientBridge));
    }

    async _runInEachIframe(cb) {
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

    async _disableFrameAnimations() {
        const result = await this._clientBridge.call("disableFrameAnimations");

        if (result && result.error) {
            throw new Error(
                `Disable animations failed with error type '${result.error}' and error message: ${result.message}`,
            );
        }

        return result;
    }

    async _disableIframeAnimations() {
        await this._runInEachIframe(() => this._disableFrameAnimations());
    }

    async _cleanupFrameAnimations() {
        return this._clientBridge.call("cleanupFrameAnimations");
    }

    async _cleanupIframeAnimations() {
        await this._runInEachIframe(() => this._cleanupFrameAnimations());
    }

    async _cleanupPageAnimations() {
        await this._cleanupFrameAnimations();

        if (this._config.automationProtocol === "webdriver") {
            await this._cleanupIframeAnimations();
        }
    }

    _stubCommands() {
        for (let commandName of this._session.commandList) {
            if (commandName === "deleteSession") {
                continue;
            }

            if (_.isFunction(this._session[commandName])) {
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                this._session.overwriteCommand(commandName, () => {});
            }
        }
    }

    get meta() {
        return this._meta;
    }

    get emitter() {
        return this._emitter;
    }
};
