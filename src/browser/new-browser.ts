import { URLSearchParams } from "url";

import URI from "urijs";
import { isBoolean, assign, isEmpty } from "lodash";
import { remote, RemoteOptions } from "webdriverio";

import { Browser, BrowserOpts } from "./browser";
import signalHandler from "../signal-handler";
import { runGroup } from "./history";
import { warn } from "../utils/logger";
import { getInstance } from "../config/runtime-config";
import { DEVTOOLS_PROTOCOL } from "../constants/config";
import { Config } from "../config";
import { BrowserConfig } from "../config/browser-config";

export type CapabilityName = "goog:chromeOptions" | "moz:firefoxOptions" | "ms:edgeOptions";
export type HeadlessBrowserOptions = Record<
    string,
    {
        capabilityName: CapabilityName;
        getArgs: (headlessMode: BrowserConfig["headless"]) => string[];
    }
>;
const DEFAULT_PORT = 4444;

const headlessBrowserOptions: HeadlessBrowserOptions = {
    chrome: {
        capabilityName: "goog:chromeOptions",
        getArgs: (headlessMode: BrowserConfig["headless"]): string[] => {
            const headlessValue = isBoolean(headlessMode) ? "headless" : `headless=${headlessMode}`;

            return [headlessValue, "disable-gpu"];
        },
    },
    firefox: {
        capabilityName: "moz:firefoxOptions",
        getArgs: (): string[] => ["-headless"],
    },
    msedge: {
        capabilityName: "ms:edgeOptions",
        getArgs: (): string[] => ["--headless"],
    },
    edge: {
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
        this._addHistory();

        await runGroup(this._callstackHistory, "testplane: init browser", async () => {
            this._addCommands();
            this.restoreHttpTimeout();
            await this._setPageLoadTimeout();
        });

        return this;
    }

    reset(): Promise<void> {
        return Promise.resolve();
    }

    async quit(): Promise<void> {
        try {
            this.setHttpTimeout(this._config.sessionQuitTimeout);
            await this._session!.deleteSession();
        } catch (e) {
            warn(`WARNING: Can not close session: ${(e as Error).message}`);
        }
    }

    protected _createSession(): Promise<WebdriverIO.Browser> {
        const sessionOpts = this._getSessionOpts();

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

    protected _getSessionOpts(): RemoteOptions {
        const config = this._config;
        const gridUri = new URI(config.gridUrl);
        const capabilities = this._extendCapabilities(config);
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
            connectionRetryCount: 0, // testplane has its own advanced retries
            baseUrl: config.baseUrl,
            waitforTimeout: config.waitTimeout,
            waitforInterval: config.waitInterval,
            ...this._getSessionOptsFromConfig(),
        };

        return options as RemoteOptions;
    }

    protected _extendCapabilities(config: BrowserConfig): WebdriverIO.Capabilities {
        const capabilitiesExtendedByVersion = this.version
            ? this._extendCapabilitiesByVersion()
            : config.desiredCapabilities;
        const capabilitiesWithAddedHeadless = this._addHeadlessCapability(
            config.headless,
            capabilitiesExtendedByVersion!,
        );
        return capabilitiesWithAddedHeadless;
    }

    protected _addHeadlessCapability(
        headless: BrowserConfig["headless"],
        capabilities: WebdriverIO.Capabilities,
    ): WebdriverIO.Capabilities {
        if (!headless) {
            return capabilities;
        }
        const capabilitySettings =
            headlessBrowserOptions[capabilities.browserName as keyof typeof headlessBrowserOptions];
        if (!capabilitySettings) {
            warn(`WARNING: Headless setting is not supported for ${capabilities.browserName} browserName`);
            return capabilities;
        }
        const browserCapabilities = (capabilities[capabilitySettings.capabilityName as CapabilityName] ??
            {}) as WebdriverIO.Capabilities[CapabilityName];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (capabilities as any)[capabilitySettings.capabilityName] = {
            ...browserCapabilities,
            args: [...(browserCapabilities!.args ?? []), ...capabilitySettings.getArgs(headless)],
        };
        return capabilities;
    }

    protected _extendCapabilitiesByVersion(): WebdriverIO.Capabilities {
        const { desiredCapabilities, sessionEnvFlags } = this._config;
        const versionKeyName =
            desiredCapabilities!.browserVersion || sessionEnvFlags.isW3C ? "browserVersion" : "version";

        return assign({}, desiredCapabilities, { [versionKeyName]: this.version });
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
