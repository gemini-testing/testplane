import { URLSearchParams } from "url";
import URI from "urijs";
import { isBoolean, assign, isEmpty, set } from "lodash";
import { remote } from "@testplane/webdriverio";
import type { Capabilities } from "@testplane/wdio-types";

import { Browser, BrowserOpts } from "./browser";
import signalHandler from "../signal-handler";
import { runGroup } from "./history";
import { warn } from "../utils/logger";
import { getNormalizedBrowserName } from "../utils/browser";
import { getInstance } from "../config/runtime-config";
import {
    DEVTOOLS_PROTOCOL,
    WEBDRIVER_PROTOCOL,
    LOCAL_GRID_URL,
    W3C_CAPABILITIES,
    VENDOR_CAPABILITIES,
} from "../constants/config";
import { Config } from "../config";
import { BrowserConfig } from "../config/browser-config";
import { gridUrl as DEFAULT_GRID_URL } from "../config/defaults";
import { BrowserName, type W3CBrowserName } from "./types";

export type VendorSpecificCapabilityName = "goog:chromeOptions" | "moz:firefoxOptions" | "ms:edgeOptions";
export type HeadlessBrowserOptions = Partial<
    Record<
        W3CBrowserName,
        {
            capabilityName: VendorSpecificCapabilityName;
            getArgs: (headlessMode: BrowserConfig["headless"]) => string[];
        }
    >
>;
const DEFAULT_PORT = 4444;

const headlessBrowserOptions: HeadlessBrowserOptions = {
    [BrowserName.CHROME]: {
        capabilityName: "goog:chromeOptions",
        getArgs: (headlessMode: BrowserConfig["headless"]): string[] => {
            const headlessValue = isBoolean(headlessMode) ? "headless" : `headless=${headlessMode}`;

            return [headlessValue, "disable-gpu"];
        },
    },
    [BrowserName.CHROMEHEADLESSSHELL]: {
        capabilityName: "goog:chromeOptions",
        getArgs: (headlessMode: BrowserConfig["headless"]): string[] => {
            const headlessValue = isBoolean(headlessMode) ? "headless" : `headless=${headlessMode}`;

            return [headlessValue, "disable-gpu"];
        },
    },
    [BrowserName.FIREFOX]: {
        capabilityName: "moz:firefoxOptions",
        getArgs: (): string[] => ["-headless"],
    },
    [BrowserName.EDGE]: {
        capabilityName: "ms:edgeOptions",
        getArgs: (): string[] => ["--headless"],
    },
};

export class NewBrowser extends Browser {
    constructor(config: Config, opts: BrowserOpts) {
        super(config, opts);

        signalHandler.on("exit", () => this.quit());
    }

    async init(): Promise<NewBrowser> {
        this._session = await this._createSession();

        this._extendStacktrace();
        this._addSteps();
        await this._installFirefoxCSPAddOn();
        this._addQueries();
        this._addHistory();

        await runGroup(
            {
                session: this._session,
                callstack: this._callstackHistory!,
                config: this._config,
            },
            "testplane: init browser",
            async () => {
                this._addCommands();
                this.restoreHttpTimeout();
                await this._setPageLoadTimeout();
            },
        );

        return this;
    }

    reset(): Promise<void> {
        return Promise.resolve();
    }

    async quit(): Promise<void> {
        try {
            this.setHttpTimeout(this._config.sessionQuitTimeout);
            await this._session!.deleteSession();
            this._wdProcess?.free();
        } catch (e) {
            warn(`WARNING: Can not close session: ${(e as Error).message}`);
            this._wdProcess?.kill();
        } finally {
            this._wdProcess = null;
        }
    }

    async kill(): Promise<void> {
        try {
            await this._session!.deleteSession();
            this._wdProcess?.kill();
        } catch (e) {
            warn(`WARNING: Can not kill WebDriver process: ${(e as Error).message}`);
        }
    }

    protected async _createSession(): Promise<WebdriverIO.Browser> {
        const sessionOpts = await this._getSessionOpts();

        return remote(sessionOpts);
    }

    protected async _setPageLoadTimeout(): Promise<void> {
        if (!this._config.pageLoadTimeout) {
            return;
        }

        try {
            await this._session!.setTimeout({ pageLoad: this._config.pageLoadTimeout });
        } catch (e) {
            // edge with w3c does not support setting page load timeout
            if (
                this._session!.isW3C &&
                (this._session!.capabilities as { browserName: string }).browserName === "MicrosoftEdge"
            ) {
                warn(`WARNING: Can not set page load timeout: ${(e as Error).message}`);
            } else {
                throw e;
            }
        }
    }

    protected _isLocalGridUrl(): boolean {
        return this._config.gridUrl === LOCAL_GRID_URL || getInstance().local;
    }

    protected async _getSessionOpts(): Promise<Capabilities.WebdriverIOConfig> {
        const config = this._config;

        let gridUrl;

        if (this._isLocalGridUrl() && config.automationProtocol === WEBDRIVER_PROTOCOL) {
            gridUrl = await this._getLocalWebdriverGridUrl();
        } else {
            // if automationProtocol is not "webdriver", fallback to default grid url from "local"
            // because in "devtools" protocol we dont need gridUrl, but it still has to be valid URL
            gridUrl = config.gridUrl === LOCAL_GRID_URL ? DEFAULT_GRID_URL : config.gridUrl;
        }

        const gridUri = new URI(gridUrl);

        const capabilities = await this._extendCapabilities(config);

        const { devtools } = getInstance();

        const options = {
            protocol: gridUri.protocol(),
            hostname: this._getGridHost(gridUri),
            port: gridUri.port() ? parseInt(gridUri.port(), 10) : DEFAULT_PORT,
            path: gridUri.path(),
            queryParams: this._getQueryParams(gridUri.query()),
            capabilities,
            automationProtocol: devtools ? DEVTOOLS_PROTOCOL : config.automationProtocol,
            connectionRetryTimeout: config.sessionRequestTimeout || config.httpTimeout,
            connectionRetryCount: 3,
            baseUrl: config.baseUrl,
            waitforTimeout: config.waitTimeout,
            waitforInterval: config.waitInterval,
            ...this._getSessionOptsFromConfig(),
        };

        return options as Capabilities.WebdriverIOConfig;
    }

    protected _extendCapabilities(config: BrowserConfig): Promise<WebdriverIO.Capabilities> {
        const capabilitiesExtendedByVersion = this.version
            ? this._extendCapabilitiesByVersion()
            : config.desiredCapabilities;
        const capabilitiesExtendedByProtocol = this._addWebDriverClassicCapability(capabilitiesExtendedByVersion!);
        const capabilitiesWithAddedHeadless = this._addHeadlessCapability(
            config.headless,
            capabilitiesExtendedByProtocol!,
        );

        return this._isLocalGridUrl()
            ? this._applyLocalBrowserCapabilities(config, capabilitiesWithAddedHeadless)
            : Promise.resolve(capabilitiesWithAddedHeadless);
    }

    protected _addHeadlessCapability(
        headless: BrowserConfig["headless"],
        capabilities: WebdriverIO.Capabilities,
    ): WebdriverIO.Capabilities {
        if (!headless) {
            return capabilities;
        }
        const browserNameW3C = getNormalizedBrowserName(capabilities.browserName);

        if (!browserNameW3C) {
            return capabilities;
        }

        const capabilitySettings = headlessBrowserOptions[browserNameW3C];
        if (!capabilitySettings) {
            warn(`WARNING: Headless setting is not supported for ${capabilities.browserName} browserName`);
            return capabilities;
        }
        const browserCapabilities = (capabilities[capabilitySettings.capabilityName as VendorSpecificCapabilityName] ??
            {}) as WebdriverIO.Capabilities[VendorSpecificCapabilityName];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (capabilities as any)[capabilitySettings.capabilityName] = {
            ...browserCapabilities,
            args: [...(browserCapabilities!.args ?? []), ...capabilitySettings.getArgs(headless)],
        };
        return capabilities;
    }

    protected _addWebDriverClassicCapability(capabilities: WebdriverIO.Capabilities): WebdriverIO.Capabilities {
        if (capabilities?.webSocketUrl || "wdio:enforceWebDriverClassic" in capabilities) {
            return capabilities;
        }

        return assign({}, capabilities, { "wdio:enforceWebDriverClassic": true });
    }

    protected _extendCapabilitiesByVersion(): WebdriverIO.Capabilities {
        const { desiredCapabilities, sessionEnvFlags } = this._config;
        const versionKeyName =
            desiredCapabilities!.browserVersion || sessionEnvFlags.isW3C ? "browserVersion" : "version";

        return assign({}, desiredCapabilities, { [versionKeyName]: this.version });
    }

    protected async _getLocalWebdriverGridUrl(): Promise<string> {
        if (!this._wdPool) {
            throw new Error("webdriver pool is not defined");
        }

        if (this._wdProcess) {
            return this._wdProcess.gridUrl;
        }

        this._wdProcess = await this._wdPool.getWebdriver(
            this._config.desiredCapabilities?.browserName,
            this._config.desiredCapabilities?.browserVersion,
            { debug: this._config.system.debug },
        );

        return this._wdProcess.gridUrl;
    }

    protected async _applyLocalBrowserCapabilities(
        config: BrowserConfig,
        capabilities: WebdriverIO.Capabilities,
    ): Promise<WebdriverIO.Capabilities> {
        const { installBrowser } = await import("../browser-installer");
        const browserNameW3C = getNormalizedBrowserName(config.desiredCapabilities?.browserName);

        if (!browserNameW3C) {
            throw new Error(
                [
                    `Running auto local "${config.desiredCapabilities?.browserName}" is unsupported`,
                    `Supported browsers: "chrome", "firefox", "safari", "edge"`,
                ].join("\n"),
            );
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
            capabilities[capabilitySettings.capabilityName]!.binary ||= executablePath;
        }

        const filteredCapabilities: WebdriverIO.Capabilities = Object.keys(capabilities)
            .filter(capabilityName => {
                const isW3CCapability = W3C_CAPABILITIES.includes(capabilityName);
                const isVendorSpecificCapability = VENDOR_CAPABILITIES[browserNameW3C].includes(capabilityName);

                return isW3CCapability || isVendorSpecificCapability;
            })
            .reduce((acc, capabilityName) => {
                return set(acc, [capabilityName], capabilities[capabilityName as keyof WebdriverIO.Capabilities]);
            }, {});

        return filteredCapabilities;
    }

    protected _getGridHost(url: URI): string {
        return new URI({
            username: url.username(),
            password: url.password(),
            hostname: url.hostname(),
        })
            .toString()
            .slice(2); // URIjs leaves `//` prefix, removing it
    }

    protected _getQueryParams(query: string): Record<string, string> {
        if (isEmpty(query)) {
            return {};
        }

        const urlParams = new URLSearchParams(query);
        return Object.fromEntries(urlParams);
    }
}
