import { Config } from "../../config";
import { NewBrowser } from "./../new-browser";
import { ExistingBrowser } from "./../existing-browser";
import { Calibrator } from "./../calibrator";
import { AsyncEmitter, MasterEvents } from "../../events";
import { BrowserName, type W3CBrowserName } from "./../types";
import { getNormalizedBrowserName } from "../../utils/browser";
import { LOCAL_GRID_URL } from "../../constants/config";
import { WebdriverPool } from "../../browser-pool/webdriver-pool";
import type { StandaloneBrowserOptionsInput } from "./types";
import fs from "fs-extra";
import { hasGlobalFilesToRemove } from "../../globalFilesToRemove";

const webdriverPool = new WebdriverPool();

export async function launchBrowser(
    options: StandaloneBrowserOptionsInput = {},
): Promise<WebdriverIO.Browser & { getDriverPid?: () => number | undefined }> {
    const desiredCapabilities = options.desiredCapabilities || {};

    const browserName = desiredCapabilities.browserName || BrowserName.CHROME;
    const normalizedBrowserName = getNormalizedBrowserName(browserName) as W3CBrowserName;

    if (!normalizedBrowserName) {
        const lines: string[] = [];

        lines.push(`Cannot launch browser: "${browserName}" is not supported.`);
        lines.push(
            `\nTestplane does not know how to launch "${browserName}".`,
            `Supported browser names: "chrome", "firefox", "safari", "edge"`,
        );

        lines.push(
            "\nWhat you can do:",
            `- Pass a supported browser name in the 'desiredCapabilities.browserName' option of launchBrowser()`,
            `- Example: launchBrowser({ desiredCapabilities: { browserName: 'chrome' } })`,
        );

        throw new Error(lines.join("\n"));
    }

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
        stateOpts: options.stateOpts,
    };

    const filesToRemove: string[] = [];

    const config = new Config({
        browsers: {
            [browserName]: browserConfig,
        },
    });

    if (!process.env.WDIO_LOG_LEVEL) {
        process.env.WDIO_LOG_LEVEL = config.system.debug ? "trace" : "error";
    }

    const emitter = new AsyncEmitter();

    emitter.on(MasterEvents.ADD_FILE_TO_REMOVE, (path: string) => {
        filesToRemove.push(path);
    });

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

        if (filesToRemove.length > 0 && !hasGlobalFilesToRemove()) {
            await Promise.all(filesToRemove.map(path => fs.remove(path)));
        }
    });

    existingBrowser.publicAPI.addCommand("getDriverPid", () => newBrowser.getDriverPid());

    return existingBrowser.publicAPI;
}
