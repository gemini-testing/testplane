import { createHash } from "crypto";
import { Config } from "../../config";
import { BrowserConfig } from "../../config/browser-config";
import { ExistingBrowser } from "../existing-browser";
import { Calibrator } from "../calibrator";
import { AsyncEmitter, MasterEvents } from "../../events";
import { BrowserName, type W3CBrowserName } from "../types";
import { getNormalizedBrowserName } from "../../utils/browser";
import { LOCAL_GRID_URL } from "../../constants/config";
import { acquireStandalonePool } from "./pool";
import { AsyncCleanupStack } from "../../utils/async-cleanup-stack";
import type { StandaloneBrowserOptionsInput } from "./types";
import fs from "fs-extra";
import { hasGlobalFilesToRemove } from "../../globalFilesToRemove";
import { initImage } from "../../image";

export async function launchBrowser(
    options: StandaloneBrowserOptionsInput = {},
): Promise<WebdriverIO.Browser & AsyncDisposable & { getDriverPid?: () => number | null }> {
    await initImage();

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
        system: options.system,
        browserDownloadMirrors: options.browserDownloadMirrors,
        browsers: {
            [browserName]: browserConfig,
        },
    });
    const sessionConfig = new BrowserConfig(config.forBrowser(browserName));
    sessionConfig.id = getBrowserId(sessionConfig);

    if (!process.env.WDIO_LOG_LEVEL) {
        process.env.WDIO_LOG_LEVEL = config.system.debug ? "trace" : "error";
    }

    const emitter = new AsyncEmitter();

    emitter.on(MasterEvents.ADD_FILE_TO_REMOVE, (path: string) => {
        filesToRemove.push(path);
    });

    const { pool } = startup.use(
        await acquireStandalonePool({
            browserDownloadMirrors: config.browserDownloadMirrors,
            areLocalWdDebugLogsEnabled: config.system.debug,
        }),
    );
    const newBrowser = startup.adopt(
        await pool.getBrowser(sessionConfig, {
            version: desiredCapabilities.browserVersion,
        }),
        browser => pool.freeBrowser(browser),
    );

    const existingBrowser = startup.use(
        new ExistingBrowser(sessionConfig, {
            id: sessionConfig.id,
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
    existingBrowser.publicAPI.overwriteCommand("deleteSession", close);
    Object.defineProperty(existingBrowser.publicAPI, Symbol.asyncDispose, { value: close });
    existingBrowser.publicAPI.addCommand("getDriverPid", () => newBrowser.getDriverPid());

    cleanup = startup.move();

    return existingBrowser.publicAPI as WebdriverIO.Browser & AsyncDisposable;
}

function getBrowserId(config: BrowserConfig): string {
    const capabilities = config.desiredCapabilities;
    const version = capabilities?.browserVersion || (capabilities as { version?: string } | null)?.version || "default";
    const data = JSON.stringify([capabilities?.browserName, version, config.docker], (_key, value: unknown): unknown =>
        value && typeof value === "object" && !Array.isArray(value)
            ? Object.fromEntries(
                  Object.keys(value)
                      .sort()
                      .map(key => [key, (value as Record<string, unknown>)[key]]),
              )
            : value,
    );

    return createHash("sha256").update(data).digest("hex");
}
