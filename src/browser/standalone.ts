import { Config } from "../config";
import { NewBrowser } from "./new-browser";
import { ExistingBrowser } from "./existing-browser";
import { Calibrator } from "./calibrator";
import { AsyncEmitter } from "../events";
import { BrowserName, type W3CBrowserName } from "./types";
import { getNormalizedBrowserName } from "../utils/browser";
import { LOCAL_GRID_URL } from "../constants/config";
import { WebdriverPool } from "../browser-pool/webdriver-pool";
import RuntimeConfig from "../config/runtime-config";
import type { CommonConfig } from "../config/types";

export type StandaloneBrowserOptions = Pick<
    CommonConfig,
    | "automationProtocol"
    | "desiredCapabilities"
    | "gridUrl"
    | "baseUrl"
    | "httpTimeout"
    | "pageLoadTimeout"
    | "waitTimeout"
    | "waitInterval"
    | "headless"
    | "prepareBrowser"
    | "windowSize"
    | "orientation"
    | "headers"
    | "strictSSL"
    | "user"
    | "key"
    | "system"
>;

export type StandaloneBrowserOptionsInput = Partial<StandaloneBrowserOptions>;

export async function launchBrowser(options: StandaloneBrowserOptionsInput = {}): Promise<WebdriverIO.Browser> {
    const desiredCapabilities = options.desiredCapabilities || {};

    const browserName = desiredCapabilities.browserName || BrowserName.CHROME;
    const normalizedBrowserName = getNormalizedBrowserName(browserName) as W3CBrowserName;

    if (!normalizedBrowserName) {
        throw new Error(
            [
                `Running browser "${browserName}" is unsupported`,
                `Supported browsers: "chrome", "firefox", "safari", "edge"`,
            ].join("\n"),
        );
    }

    RuntimeConfig.getInstance().extend({
        debug: options.system?.debug ?? true,
        local: true,
    });

    const browserConfig = {
        desiredCapabilities: {
            browserName,
            ...desiredCapabilities,
        },
        gridUrl: options.gridUrl || LOCAL_GRID_URL,
        baseUrl: options.baseUrl,
        headless: options.headless !== undefined ? options.headless : true,
        pageLoadTimeout: options.pageLoadTimeout,
        httpTimeout: options.httpTimeout,
        waitTimeout: options.waitTimeout,
        waitInterval: options.waitInterval,
        automationProtocol: options.automationProtocol,
        windowSize: options.windowSize,
        orientation: options.orientation,
        headers: options.headers,
        strictSSL: options.strictSSL,
        user: options.user,
        key: options.key,
        prepareBrowser: options.prepareBrowser,
    };

    const config = new Config({
        browsers: {
            [browserName]: browserConfig,
        },
        system: options.system || {
            debug: true,
        },
    });

    const webdriverPool = new WebdriverPool();
    const emitter = new AsyncEmitter();

    const newBrowser = new NewBrowser(config, {
        id: browserName,
        version: desiredCapabilities.browserVersion,
        emitter,
        wdPool: webdriverPool,
    });

    await newBrowser.init();

    const existingBrowser = new ExistingBrowser(config, {
        id: browserName,
        version: desiredCapabilities.browserVersion,
        emitter,
        state: {},
    });

    const calibrator = new Calibrator();

    const session = newBrowser.publicAPI;

    await existingBrowser.init(
        {
            sessionId: session.sessionId,
            sessionCaps: session.capabilities,
            sessionOpts: {
                capabilities: session.capabilities,
                ...session.options,
            },
        },
        calibrator,
    );

    existingBrowser.publicAPI.overwriteCommand("deleteSession", async function () {
        await existingBrowser.quit();
        await newBrowser.kill();
    });

    return existingBrowser.publicAPI;
}
