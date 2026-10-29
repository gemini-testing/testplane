import { Config } from "../../config";
import { NewBrowser } from "./../new-browser";
import { ExistingBrowser } from "./../existing-browser";
import { Calibrator } from "./../calibrator";
import { AsyncEmitter, MasterEvents } from "../../events";
import { BrowserName, type W3CBrowserName } from "./../types";
import { getNormalizedBrowserName } from "../../utils/browser";
import { LOCAL_GRID_URL } from "../../constants/config";
import { acquireStandaloneBackend } from "../../browser-backend/standalone";
import { AsyncCleanupStack } from "../../utils/async-cleanup-stack";
import signalHandler from "../../signal-handler";
import type { StandaloneBrowserOptionsInput } from "./types";
import fs from "fs-extra";
import { hasGlobalFilesToRemove } from "../../globalFilesToRemove";

export async function launchBrowser(
    options: StandaloneBrowserOptionsInput = {},
): Promise<WebdriverIO.Browser & AsyncDisposable & { getDriverPid?: () => number | null }> {
    await using startup = new AsyncCleanupStack();
    let cleanup = startup;
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

    const browserConfig = {
        desiredCapabilities: {
            browserName,
            ...desiredCapabilities,
        },
        gridUrl: options.gridUrl || LOCAL_GRID_URL,
        docker: options.docker,
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
    startup.defer(async () => {
        if (filesToRemove.length > 0 && !hasGlobalFilesToRemove()) {
            await Promise.all(filesToRemove.map(path => fs.remove(path)));
        }
    });

    const config = new Config({
        browserDownloadMirrors: options.browserDownloadMirrors,
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

    const { backend } = startup.use(await acquireStandaloneBackend(config, browserName));
    const newBrowser = startup.use(
        await NewBrowser.create(config, backend, {
            id: browserName,
            version: desiredCapabilities.browserVersion,
            emitter,
        }),
    );

    const existingBrowser = startup.use(
        new ExistingBrowser(config, {
            id: browserName,
            version: desiredCapabilities.browserVersion,
            emitter,
            state: {},
        }),
    );

    const calibrator = new Calibrator();

    const session = newBrowser.publicAPI;

    await existingBrowser.init(
        {
            sessionId: session.sessionId,
            cdpAvailable: newBrowser.cdpAvailable,
            sessionCaps: session.capabilities,
            sessionOpts: {
                capabilities: session.capabilities,
                ...session.options,
            },
        },
        calibrator,
    );

    let closing: Promise<void> | null = null;
    const close = (): Promise<void> => (closing ??= cleanup.disposeAsync());
    signalHandler.on(MasterEvents.EXIT, close);
    startup.defer(() => {
        signalHandler.off(MasterEvents.EXIT, close);
    });
    existingBrowser.publicAPI.overwriteCommand("deleteSession", close);
    Object.defineProperty(existingBrowser.publicAPI, Symbol.asyncDispose, { value: close });
    existingBrowser.publicAPI.addCommand("getDriverPid", () => newBrowser.getDriverPid());

    cleanup = startup.move();
    return existingBrowser.publicAPI as WebdriverIO.Browser & AsyncDisposable;
}
