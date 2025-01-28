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
exports.NewBrowser = void 0;
const url_1 = require("url");
const urijs_1 = __importDefault(require("urijs"));
const lodash_1 = require("lodash");
const webdriverio_1 = require("@testplane/webdriverio");
const browser_1 = require("./browser");
const signal_handler_1 = __importDefault(require("../signal-handler"));
const history_1 = require("./history");
const logger_1 = require("../utils/logger");
const browser_2 = require("../utils/browser");
const runtime_config_1 = require("../config/runtime-config");
const config_1 = require("../constants/config");
const defaults_1 = require("../config/defaults");
const types_1 = require("./types");
const DEFAULT_PORT = 4444;
const headlessBrowserOptions = {
    [types_1.BrowserName.CHROME]: {
        capabilityName: "goog:chromeOptions",
        getArgs: (headlessMode) => {
            const headlessValue = (0, lodash_1.isBoolean)(headlessMode) ? "headless" : `headless=${headlessMode}`;
            return [headlessValue, "disable-gpu"];
        },
    },
    [types_1.BrowserName.FIREFOX]: {
        capabilityName: "moz:firefoxOptions",
        getArgs: () => ["-headless"],
    },
    [types_1.BrowserName.EDGE]: {
        capabilityName: "ms:edgeOptions",
        getArgs: () => ["--headless"],
    },
};
class NewBrowser extends browser_1.Browser {
    constructor(config, opts) {
        super(config, opts);
        signal_handler_1.default.on("exit", () => this.quit());
    }
    async init() {
        this._session = await this._createSession();
        this._extendStacktrace();
        this._addSteps();
        this._addHistory();
        await (0, history_1.runGroup)(this._callstackHistory, "testplane: init browser", async () => {
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
            this._wdProcess?.free();
        }
        catch (e) {
            (0, logger_1.warn)(`WARNING: Can not close session: ${e.message}`);
            this._wdProcess?.kill();
        }
        finally {
            this._wdProcess = null;
        }
    }
    async _createSession() {
        const sessionOpts = await this._getSessionOpts();
        return (0, webdriverio_1.remote)(sessionOpts);
    }
    async _setPageLoadTimeout() {
        if (!this._config.pageLoadTimeout) {
            return;
        }
        try {
            await this._session.setTimeout({ pageLoad: this._config.pageLoadTimeout });
        }
        catch (e) {
            // edge with w3c does not support setting page load timeout
            if (this._session.isW3C &&
                this._session.capabilities.browserName === "MicrosoftEdge") {
                (0, logger_1.warn)(`WARNING: Can not set page load timeout: ${e.message}`);
            }
            else {
                throw e;
            }
        }
    }
    _isLocalGridUrl() {
        return this._config.gridUrl === config_1.LOCAL_GRID_URL || (0, runtime_config_1.getInstance)().local;
    }
    async _getSessionOpts() {
        const config = this._config;
        let gridUrl;
        if (this._isLocalGridUrl() && config.automationProtocol === config_1.WEBDRIVER_PROTOCOL) {
            gridUrl = await this._getLocalWebdriverGridUrl();
        }
        else {
            // if automationProtocol is not "webdriver", fallback to default grid url from "local"
            // because in "devtools" protocol we dont need gridUrl, but it still has to be valid URL
            gridUrl = config.gridUrl === config_1.LOCAL_GRID_URL ? defaults_1.gridUrl : config.gridUrl;
        }
        const gridUri = new urijs_1.default(gridUrl);
        const capabilities = await this._extendCapabilities(config);
        console.log('res caps:', capabilities);
        const { devtools } = (0, runtime_config_1.getInstance)();
        const options = {
            protocol: gridUri.protocol(),
            hostname: this._getGridHost(gridUri),
            port: gridUri.port() ? parseInt(gridUri.port(), 10) : DEFAULT_PORT,
            path: gridUri.path(),
            queryParams: this._getQueryParams(gridUri.query()),
            capabilities,
            automationProtocol: devtools ? config_1.DEVTOOLS_PROTOCOL : config.automationProtocol,
            connectionRetryTimeout: config.sessionRequestTimeout || config.httpTimeout,
            connectionRetryCount: 0, // testplane has its own advanced retries
            baseUrl: config.baseUrl,
            waitforTimeout: config.waitTimeout,
            waitforInterval: config.waitInterval,
            ...this._getSessionOptsFromConfig(),
        };
        console.log('options:', options);
        return options;
    }
    _extendCapabilities(config) {
        console.log('config.caps:', config.desiredCapabilities);
        const capabilitiesExtendedByVersion = this.version
            ? this._extendCapabilitiesByVersion()
            : config.desiredCapabilities;
        const capabilitiesWithAddedHeadless = this._addHeadlessCapability(config.headless, capabilitiesExtendedByVersion);
        console.log('before EXTEND, config.desiredCapabilities?.webSocketUrl:', config.desiredCapabilities?.webSocketUrl);
        console.log('is empty, config.desiredCapabilities?.webSocketUrl:', (0, lodash_1.isEmpty)(config.desiredCapabilities?.webSocketUrl));
        const capabilitiesWithWebSocketUrl = !config.desiredCapabilities?.webSocketUrl
            ? this._extendCapabilitiesByWebSocketUrl(capabilitiesExtendedByVersion)
            : capabilitiesWithAddedHeadless;
        console.log('after EXTEND:', capabilitiesWithWebSocketUrl);
        return this._isLocalGridUrl()
            ? this._applyLocalBrowserCapabilities(config, capabilitiesWithWebSocketUrl)
            : Promise.resolve(capabilitiesWithWebSocketUrl);
    }
    _addHeadlessCapability(headless, capabilities) {
        if (!headless) {
            return capabilities;
        }
        const browserNameW3C = (0, browser_2.getNormalizedBrowserName)(capabilities.browserName);
        if (!browserNameW3C) {
            return capabilities;
        }
        const capabilitySettings = headlessBrowserOptions[browserNameW3C];
        if (!capabilitySettings) {
            (0, logger_1.warn)(`WARNING: Headless setting is not supported for ${capabilities.browserName} browserName`);
            return capabilities;
        }
        const browserCapabilities = (capabilities[capabilitySettings.capabilityName] ??
            {});
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        capabilities[capabilitySettings.capabilityName] = {
            ...browserCapabilities,
            args: [...(browserCapabilities.args ?? []), ...capabilitySettings.getArgs(headless)],
        };
        return capabilities;
    }
    _extendCapabilitiesByVersion() {
        const { desiredCapabilities, sessionEnvFlags } = this._config;
        const versionKeyName = desiredCapabilities.browserVersion || sessionEnvFlags.isW3C ? "browserVersion" : "version";
        return (0, lodash_1.assign)({}, desiredCapabilities, { [versionKeyName]: this.version });
    }
    _extendCapabilitiesByWebSocketUrl(capabilities) {
        console.log('HERE < DO NOT CALL IT');
        capabilities["wdio:enforceWebDriverClassic"] = true;
        return capabilities;
    }
    async _getLocalWebdriverGridUrl() {
        if (!this._wdPool) {
            throw new Error("webdriver pool is not defined");
        }
        if (this._wdProcess) {
            return this._wdProcess.gridUrl;
        }
        this._wdProcess = await this._wdPool.getWebdriver(this._config.desiredCapabilities?.browserName, this._config.desiredCapabilities?.browserVersion, { debug: this._config.system.debug });
        return this._wdProcess.gridUrl;
    }
    async _applyLocalBrowserCapabilities(config, capabilities) {
        const { installBrowser } = await Promise.resolve().then(() => __importStar(require("../browser-installer")));
        const browserNameW3C = (0, browser_2.getNormalizedBrowserName)(config.desiredCapabilities?.browserName);
        if (!browserNameW3C) {
            throw new Error([
                `Running auto local "${config.desiredCapabilities?.browserName}" is unsupported`,
                `Supported browsers: "chrome", "firefox", "safari", "edge"`,
            ].join("\n"));
        }
        const executablePath = await installBrowser(browserNameW3C, config.desiredCapabilities?.browserVersion, {
            shouldInstallWebDriver: false,
            shouldInstallUbuntuPackages: true,
        });
        if (executablePath) {
            const capabilitySettings = headlessBrowserOptions[browserNameW3C];
            if (!capabilitySettings) {
                return capabilities;
            }
            capabilities[capabilitySettings.capabilityName] ||= {};
            capabilities[capabilitySettings.capabilityName].binary ||= executablePath;
        }
        const filteredCapabilities = Object.keys(capabilities)
            .filter(capabilityName => {
            const isW3CCapability = config_1.W3C_CAPABILITIES.includes(capabilityName);
            const isVendorSpecificCapability = config_1.VENDOR_CAPABILITIES[browserNameW3C].includes(capabilityName);
            return isW3CCapability || isVendorSpecificCapability;
        })
            .reduce((acc, capabilityName) => {
            return (0, lodash_1.set)(acc, [capabilityName], capabilities[capabilityName]);
        }, {});
        return filteredCapabilities;
    }
    _getGridHost(url) {
        return new urijs_1.default({
            username: url.username(),
            password: url.password(),
            hostname: url.hostname(),
        })
            .toString()
            .slice(2); // URIjs leaves `//` prefix, removing it
    }
    _getQueryParams(query) {
        if ((0, lodash_1.isEmpty)(query)) {
            return {};
        }
        const urlParams = new url_1.URLSearchParams(query);
        return Object.fromEntries(urlParams);
    }
}
exports.NewBrowser = NewBrowser;
//# sourceMappingURL=new-browser.js.map