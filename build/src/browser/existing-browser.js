/* global window, document */
"use strict";
const url = require("url");
const Promise = require("bluebird");
const _ = require("lodash");
const webdriverio = require("webdriverio");
const { sessionEnvironmentDetector } = require("@wdio/utils");
const Browser = require("./browser");
const commandsList = require("./commands");
const Camera = require("./camera");
const clientBridge = require("./client-bridge");
const history = require("./history");
const logger = require("../utils/logger");
const dns = require("node:dns");
dns.setDefaultResultOrder("ipv4first"); //https://github.com/webdriverio/webdriverio/issues/8279
const OPTIONAL_SESSION_OPTS = ["transformRequest", "transformResponse"];
module.exports = class ExistingBrowser extends Browser {
    static create(config, id, version, emitter) {
        return new this(config, id, version, emitter);
    }
    constructor(config, id, version, emitter) {
        super(config, id, version);
        this._browserContext = null;
        this._emitter = emitter;
        this._camera = Camera.create(this._config.screenshotMode, () => this._takeScreenshot());
        this._meta = this._initMeta();
    }
    async init({ sessionId, sessionCaps, sessionOpts } = {}, calibrator) {
        this._session = await this._attachSession({ sessionId, sessionCaps, sessionOpts });
        this._addSteps();
        this._addHistory();
        await history.runGroup(this._callstackHistory, "hermione: init browser", async () => {
            this._addCommands();
            try {
                this.config.prepareBrowser && this.config.prepareBrowser(this.publicAPI);
            }
            catch (e) {
                logger.warn(`WARN: couldn't prepare browser ${this.id}\n`, e.stack);
            }
            await this._prepareSession(sessionId);
            await this._performCalibration(calibrator);
            await this._buildClientScripts();
        });
        return this;
    }
    async reinit(sessionId, sessionOpts) {
        await history.runGroup(this._callstackHistory, "hermione: reinit browser", async () => {
            this._session.extendOptions(sessionOpts);
            await this._prepareSession(sessionId);
        });
        return this;
    }
    async getPuppeteer() {
        try {
            return await this._session.getPuppeteer();
        }
        catch (e) {
            // assuming browser does not support CDP
            return null;
        }
    }
    async _cycleBrowserContext() {
        const puppeteer = await this.getPuppeteer();
        if (!puppeteer) {
            return;
        }
        const currentOpenWindows = await this._session.getWindowHandles();
        const context = await puppeteer.createIncognitoBrowserContext();
        // first open the new page, then close the old pages, otherwise the session will close
        await context.newPage();
        for (let handle of currentOpenWindows) {
            try {
                await this._session.switchToWindow(handle);
                await this._session.closeWindow();
            }
            catch (e) {
                if (!e.message.includes("no such window")) {
                    throw e;
                }
            }
        }
        if (this._browserContext) {
            this._browserContext.close();
        }
        this._browserContext = context;
        const [newWindow] = await this._session.getWindowHandles();
        await this._session.switchToWindow(newWindow);
    }
    markAsBroken() {
        this.applyState({ isBroken: true });
        this._stubCommands();
    }
    quit() {
        this.sessionId = null;
        this._meta = this._initMeta();
        this._state = { isBroken: false };
    }
    async prepareScreenshot(selectors, opts = {}) {
        opts = _.extend(opts, {
            usePixelRatio: this._calibration ? this._calibration.usePixelRatio : true,
        });
        const result = await this._clientBridge.call("prepareScreenshot", [selectors, opts]);
        if (result.error) {
            throw new Error(`Prepare screenshot failed with error type '${result.error}' and error message: ${result.message}`);
        }
        return result;
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
            options: _.pick(sessionOpts, "automationProtocol"),
            capabilities: { ...sessionOpts.capabilities, ...sessionCaps },
            requestedCapabilities: sessionOpts.capabilities,
        };
        return webdriverio.attach(opts);
    }
    _initMeta() {
        return {
            pid: process.pid,
            browserVersion: this.version,
            ...this._config.meta,
        };
    }
    _takeScreenshot() {
        return this._session.takeScreenshot();
    }
    _addCommands() {
        this._addMetaAccessCommands(this._session);
        this._decorateUrlMethod(this._session);
        commandsList.forEach(command => require(`./commands/${command}`)(this));
        super._addCommands();
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
    async _prepareSession(sessionId) {
        this._attach(sessionId);
        await this._cycleBrowserContext();
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
    _attach(sessionId) {
        this.sessionId = sessionId;
    }
    _stubCommands() {
        for (let commandName of this._session.commandList) {
            if (commandName === "deleteSession") {
                continue;
            }
            if (_.isFunction(this._session[commandName])) {
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                this._session.overwriteCommand(commandName, () => { });
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
//# sourceMappingURL=existing-browser.js.map