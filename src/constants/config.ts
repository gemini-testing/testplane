import { BrowserName, type W3CBrowserName } from "../browser/types";

export const ENV_PREFIXES = ["testplane_", "hermione_"];

export const WEBDRIVER_PROTOCOL = "webdriver";
export const DEVTOOLS_PROTOCOL = "devtools";
export const SAVE_HISTORY_MODE = {
    ALL: "all",
    NONE: "none",
    ONLY_FAILED: "onlyFailed",
};
export const NODEJS_TEST_RUN_ENV = "nodejs";
export const BROWSER_TEST_RUN_ENV = "browser";
export const LOCAL_GRID_URL = "local";

// https://www.w3.org/TR/webdriver/#capabilities
export const W3C_CAPABILITIES = [
    "browserName",
    "browserVersion",
    "platformName",
    "acceptInsecureCerts",
    "pageLoadStrategy",
    "proxy",
    "setWindowRect",
    "timeouts",
    "strictFileInteractability",
    "unhandledPromptBehavior",
    "userAgent",
    "websocketUrl",
    "wdio:enforceWebDriverClassic",
];

export const VENDOR_CAPABILITIES: Record<W3CBrowserName, string[]> = {
    // https://developer.chrome.com/docs/chromedriver/capabilities
    [BrowserName.CHROME]: ["goog:chromeOptions", "perfLoggingPrefs"],
    [BrowserName.CHROMEHEADLESSSHELL]: ["goog:chromeOptions", "perfLoggingPrefs"],
    // https://developer.mozilla.org/en-US/docs/Web/WebDriver/Capabilities/firefoxOptions
    [BrowserName.FIREFOX]: ["moz:firefoxOptions"],
    // https://learn.microsoft.com/en-us/microsoft-edge/webdriver-chromium/capabilities-edge-options
    [BrowserName.EDGE]: ["ms:edgeOptions"],
    // https://developer.apple.com/documentation/webkit/about-webdriver-for-safari
    [BrowserName.SAFARI]: ["safari:automaticInspection", "safari:automaticProfiling", "useTechnologyPreview"],
};
