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

export interface StandaloneBrowserOptions {
    /**
     * Browser to launch. Defaults to 'chrome'.
     */
    browserName?: string;
    
    /**
     * Browser version to use. If not specified, the latest stable version will be installed.
     */
    browserVersion?: string;
    
    /**
     * Base URL to navigate to when browser launches
     */
    baseUrl?: string;
    
    /**
     * Whether to run browser in headless mode. Defaults to true.
     */
    headless?: boolean | "new" | "old" | null;
    
    /**
     * Page load timeout in milliseconds
     */
    pageLoadTimeout?: number;
    
    /**
     * HTTP request timeout in milliseconds
     */
    httpTimeout?: number;
    
    /**
     * Wait timeout in milliseconds for WebdriverIO waitFor commands
     */
    waitTimeout?: number;
    
    /**
     * Wait interval in milliseconds for WebdriverIO waitFor commands
     */
    waitInterval?: number;
    
    /**
     * Enable debug mode for browser driver initialization
     */
    debug?: boolean;
}

export async function launchBrowser(options: StandaloneBrowserOptions = {}): Promise<WebdriverIO.Browser> {
    // Set default options
    const browserName = options.browserName || BrowserName.CHROME;
    const normalizedBrowserName = getNormalizedBrowserName(browserName) as W3CBrowserName;
    
    if (!normalizedBrowserName) {
        throw new Error(
            [
                `Running browser "${browserName}" is unsupported`,
                `Supported browsers: "chrome", "firefox", "safari", "edge"`,
            ].join("\n"),
        );
    }
    
    // Set debug and local mode in runtime config
    RuntimeConfig.getInstance().extend({
        debug: options.debug ?? true,
        local: true,
    });
    
    // Create a minimal config for the browser
    const browserConfig = {
        desiredCapabilities: {
            browserName,
            browserVersion: options.browserVersion,
        },
        gridUrl: LOCAL_GRID_URL, // Use local grid URL to ensure WebDriver is started automatically
        baseUrl: options.baseUrl,
        headless: options.headless !== undefined ? options.headless : true,
        pageLoadTimeout: options.pageLoadTimeout,
        httpTimeout: options.httpTimeout,
        waitTimeout: options.waitTimeout,
        waitInterval: options.waitInterval,
    };

    const config = new Config({
        browsers: {
            [browserName]: browserConfig,
        },
        system: {
            debug: options.debug ?? true,  // Enable debug by default
        }
    });
    
    // Initialize WebDriver pool for local browser execution
    const webdriverPool = new WebdriverPool();
    const emitter = new AsyncEmitter();
    
    // Create and initialize a new browser instance
    const newBrowser = new NewBrowser(config, {
        id: browserName,
        version: options.browserVersion,
        emitter,
        wdPool: webdriverPool, // Pass the WebDriver pool to handle driver initialization
    });
    
    await newBrowser.init();

    // console.log("newBrowser.publicAPI.options");
    // console.dir(newBrowser.publicAPI.options);
    
    // Create an existing browser that connects to the new browser session
    const existingBrowser = new ExistingBrowser(config, {
        id: browserName,
        version: options.browserVersion,
        emitter,

        state: {},
    });
    
    const calibrator = new Calibrator();
    
    // Get session info from the new browser's public API to avoid accessing protected properties
    const session = newBrowser.publicAPI;
    
    // Initialize existing browser with the session from the new browser
    await existingBrowser.init({
        sessionId: session.sessionId,
        sessionCaps: session.capabilities,
        sessionOpts: newBrowser.publicAPI.options as any,
    }, calibrator);
    
    return existingBrowser.publicAPI;
}

export const browser = {
    launch: launchBrowser,
}; 