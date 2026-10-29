import type { Capabilities } from "@testplane/wdio-types";
import URI from "urijs";
import { BrowserConfig } from "../config/browser-config";
import _, { assign, isBoolean, isEmpty } from "lodash";
import { URLSearchParams } from "url";
import { NEW_ISSUE_LINK } from "../constants/help";
import { getNormalizedBrowserName } from "./browser";
import { warn } from "./logger";
import { BrowserName, VENDOR_CAPABILITY_BY_BROWSER_NAME, W3CBrowserName } from "../browser/types";
import { X_REQUEST_ID_DELIMITER } from "../constants/browser";
import crypto from "crypto";
import { RequestLibOptions } from "@testplane/wdio-types/build/Options";
import { getTestContext } from "./test-context";

const getGridHost = (url: URI): string => {
    return new URI({
        username: url.username(),
        password: url.password(),
        hostname: url.hostname(),
    })
        .toString()
        .slice(2); // URIjs leaves `//` prefix, removing it
};

const getQueryParams = (query: string): Record<string, string> => {
    if (isEmpty(query)) {
        return {};
    }

    const urlParams = new URLSearchParams(query);
    return Object.fromEntries(urlParams);
};

const applyVersionOverride = (
    capabilities: WebdriverIO.Capabilities,
    sessionEnvFlags: BrowserConfig["sessionEnvFlags"],
    version: string,
): WebdriverIO.Capabilities => {
    const versionKeyName = capabilities!.browserVersion || sessionEnvFlags.isW3C ? "browserVersion" : "version";

    return assign({}, capabilities, { [versionKeyName]: version });
};

const disableBidiIfNeeded = (capabilities: WebdriverIO.Capabilities): WebdriverIO.Capabilities => {
    const INTERNET_EXPLORER_BROWSER_NAME = "internet explorer";
    const WEBDRIVER_CLASSIC_CAPABILITY = "wdio:enforceWebDriverClassic";

    if (
        capabilities.browserName?.toLowerCase() === INTERNET_EXPLORER_BROWSER_NAME ||
        capabilities?.webSocketUrl ||
        WEBDRIVER_CLASSIC_CAPABILITY in capabilities
    ) {
        return capabilities;
    }

    return assign({}, capabilities, { [WEBDRIVER_CLASSIC_CAPABILITY]: true });
};

const resolveHeadlessMode = (
    capabilities: WebdriverIO.Capabilities,
    headlessMode: BrowserConfig["headless"],
): WebdriverIO.Capabilities => {
    if (!headlessMode) {
        return capabilities;
    }
    const browserNameW3C = getNormalizedBrowserName(capabilities.browserName);

    if (!browserNameW3C) {
        return capabilities;
    }

    const vendorCapability = VENDOR_CAPABILITY_BY_BROWSER_NAME[browserNameW3C];
    if (!vendorCapability) {
        warn(`WARNING: Headless setting is not supported for ${capabilities.browserName} browserName`);
        return capabilities;
    }

    const existingArgsUnsafe = _.get(capabilities, [vendorCapability, "args"]) as unknown;
    const existingArgs = Array.isArray(existingArgsUnsafe) ? existingArgsUnsafe : [];
    if ([BrowserName.CHROME, BrowserName.CHROMEHEADLESSSHELL as W3CBrowserName].includes(browserNameW3C)) {
        const headlessValue = isBoolean(headlessMode) ? "headless" : `headless=${headlessMode}`;
        _.set(capabilities, [vendorCapability, "args"], [...existingArgs, headlessValue, "disable-gpu"]);
    } else if (browserNameW3C === BrowserName.FIREFOX) {
        _.set(capabilities, [vendorCapability, "args"], [...existingArgs, "-headless"]);
    } else if (browserNameW3C === BrowserName.EDGE) {
        _.set(capabilities, [vendorCapability, "args"], [...existingArgs, "--headless"]);
    }

    return capabilities;
};

const CUSTOM_SESSION_OPTS = [
    "outputDir",
    "agent",
    "headers",
    "transformRequest",
    "transformResponse",
    "strictSSL",
    // cloud service opts
    "user",
    "key",
    "region",
];

export const getSessionOptsFromConfig = (
    config: BrowserConfig,
    optNames = CUSTOM_SESSION_OPTS,
): Partial<Capabilities.WebdriverIOConfig> => {
    return optNames.reduce((options: Partial<Capabilities.WebdriverIOConfig>, optName) => {
        if (optName === "transformRequest") {
            options[optName] = (req: RequestLibOptions): RequestLibOptions => {
                if (!_.isNull(config[optName])) {
                    req = config[optName](req);
                }

                const requestHeaders = req.headers as Record<string, string>;
                const context = getTestContext();

                if (!requestHeaders["X-Request-ID"]) {
                    const requestId = crypto.randomUUID();
                    requestHeaders["X-Request-ID"] = context
                        ? `${context.testXReqId}${X_REQUEST_ID_DELIMITER}${requestId}`
                        : requestId;
                }
                if (!requestHeaders["traceparent"] && context?.traceparent) {
                    requestHeaders["traceparent"] = context.traceparent;
                }

                return req;
            };
        } else if (!_.isNull(config[optName as keyof BrowserConfig])) {
            (options as Record<string, unknown>)[optName] = config[optName as keyof BrowserConfig];
        }

        return options;
    }, {});
};

export const getWdioCreateSessionOpts = (
    gridUrl: string,
    config: BrowserConfig,
    versionOverride: string | null = null,
): Capabilities.WebdriverIOConfig => {
    const DEFAULT_GRID_PORT = 4444;

    const gridUri = new URI(gridUrl);

    let capabilities = _.cloneDeep(config.desiredCapabilities);
    if (!capabilities) {
        throw new Error(
            `Browser config doesn't have desiredCapabilities! This is likely an issue with Testplane itself. File an issue: ${NEW_ISSUE_LINK}`,
        );
    }

    if (versionOverride) {
        capabilities = applyVersionOverride(capabilities, config.sessionEnvFlags, versionOverride);
    }
    capabilities = disableBidiIfNeeded(capabilities);
    capabilities = resolveHeadlessMode(capabilities, config.headless);

    const options = {
        protocol: gridUri.protocol(),
        hostname: getGridHost(gridUri),
        port: gridUri.port() ? parseInt(gridUri.port(), 10) : DEFAULT_GRID_PORT,
        path: gridUri.path(),
        queryParams: getQueryParams(gridUri.query()),
        capabilities,
        automationProtocol: config.automationProtocol,
        connectionRetryTimeout: config.sessionRequestTimeout || config.httpTimeout,
        connectionRetryCount: 3,
        baseUrl: config.baseUrl,
        waitforTimeout: config.waitTimeout,
        waitforInterval: config.waitInterval,
        ...getSessionOptsFromConfig(config),
    };

    return options as Capabilities.WebdriverIOConfig;
};
