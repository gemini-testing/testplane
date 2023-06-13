"use strict";

const { URLSearchParams } = require("url");
const URI = require("urijs");
const _ = require("lodash");
const webdriverio = require("webdriverio");
const Browser = require("./browser");
const signalHandler = require("../signal-handler");
const history = require("./history");
const logger = require("../utils/logger");

const DEFAULT_PORT = 4444;

module.exports = class NewBrowser extends Browser {
    constructor(config, id, version) {
        super(config, id, version);

        signalHandler.on("exit", () => this.quit());
    }

    async init() {
        this._session = await this._createSession();

        this._addSteps();
        this._addHistory();

        await history.runGroup(this._callstackHistory, "hermione: init browser", async () => {
            this._addCommands();
            this.restoreHttpTimeout();
            await this._setPageLoadTimeout();
        });

        return this;
    }

    reset() {
        return Promise.resolve();
    }

    async quit() {
        try {
            this.setHttpTimeout(this._config.sessionQuitTimeout);
            await this._session.deleteSession();
        } catch (e) {
            logger.warn(`WARNING: Can not close session: ${e.message}`);
        }
    }

    _createSession() {
        const sessionOpts = this._getSessionOpts();

        return webdriverio.remote(sessionOpts);
    }

    async _setPageLoadTimeout() {
        if (!this._config.pageLoadTimeout) {
            return;
        }

        try {
            await this._session.setTimeout({ pageLoad: this._config.pageLoadTimeout });
        } catch (e) {
            // edge with w3c does not support setting page load timeout
            if (this._session.isW3C && this._session.capabilities.browserName === "MicrosoftEdge") {
                logger.warn(`WARNING: Can not set page load timeout: ${e.message}`);
            } else {
                throw e;
            }
        }
    }

    _getSessionOpts() {
        const config = this._config;
        const gridUri = new URI(config.gridUrl);
        const capabilities = this._extendCapabilities(config);

        const options = {
            protocol: gridUri.protocol(),
            hostname: this._getGridHost(gridUri),
            port: gridUri.port() ? parseInt(gridUri.port(), 10) : DEFAULT_PORT,
            path: gridUri.path(),
            queryParams: this._getQueryParams(gridUri.query()),
            capabilities,
            automationProtocol: config.automationProtocol,
            logLevel: this._debug ? "trace" : "error",
            connectionRetryTimeout: config.sessionRequestTimeout || config.httpTimeout,
            connectionRetryCount: 0, // hermione has its own advanced retries
            baseUrl: config.baseUrl,
            waitforTimeout: config.waitTimeout,
            waitforInterval: config.waitInterval,
            ...this._getSessionOptsFromConfig(),
        };

        return options;
    }

    _extendCapabilities(config) {
        const capabilitiesExtendedByVersion = this.version
            ? this._extendCapabilitiesByVersion()
            : config.desiredCapabilities;
        const capabilitiesWithAddedHeadless = this._addHeadlessCapability(
            config.headless,
            capabilitiesExtendedByVersion,
        );
        return capabilitiesWithAddedHeadless;
    }

    _addHeadlessCapability(headless, capabilities) {
        if (!headless) {
            return capabilities;
        }
        if (capabilities.browserName === "chrome") {
            capabilities["goog:chromeOptions"] = [
                ...(capabilities["goog:chromeOptions"] ?? []),
                "headless",
                "disable-gpu",
            ];
        }
        if (capabilities.browserName === "firefox") {
            capabilities["moz:firefoxOptions"] = [...(capabilities["moz:firefoxOptions"] ?? []), "-headless"];
        }
        if (capabilities.browserName === "msedge") {
            capabilities["ms:edgeOptions"] = [...(capabilities["ms:edgeOptions"] ?? []), "--headless"];
        }
        return capabilities;
    }

    _extendCapabilitiesByVersion() {
        const { desiredCapabilities, sessionEnvFlags } = this._config;
        const versionKeyName =
            desiredCapabilities.browserVersion || sessionEnvFlags.isW3C ? "browserVersion" : "version";

        return _.assign({}, desiredCapabilities, { [versionKeyName]: this.version });
    }

    _getGridHost(url) {
        return new URI({
            username: url.username(),
            password: url.password(),
            hostname: url.hostname(),
        })
            .toString()
            .slice(2); // URIjs leaves `//` prefix, removing it
    }

    _getQueryParams(query) {
        if (_.isEmpty(query)) {
            return {};
        }

        const urlParams = new URLSearchParams(query);
        return Object.fromEntries(urlParams);
    }
};
