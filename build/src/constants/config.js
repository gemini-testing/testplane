"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VENDOR_CAPABILITIES = exports.W3C_CAPABILITIES = exports.LOCAL_GRID_URL = exports.BROWSER_TEST_RUN_ENV = exports.NODEJS_TEST_RUN_ENV = exports.SAVE_HISTORY_MODE = exports.DEVTOOLS_PROTOCOL = exports.WEBDRIVER_PROTOCOL = void 0;
const types_1 = require("../browser/types");
exports.WEBDRIVER_PROTOCOL = "webdriver";
exports.DEVTOOLS_PROTOCOL = "devtools";
exports.SAVE_HISTORY_MODE = {
    ALL: "all",
    NONE: "none",
    ONLY_FAILED: "onlyFailed",
};
exports.NODEJS_TEST_RUN_ENV = "nodejs";
exports.BROWSER_TEST_RUN_ENV = "browser";
exports.LOCAL_GRID_URL = "local";
// https://www.w3.org/TR/webdriver/#capabilities
exports.W3C_CAPABILITIES = [
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
];
exports.VENDOR_CAPABILITIES = {
    // https://developer.chrome.com/docs/chromedriver/capabilities
    [types_1.BrowserName.CHROME]: ["goog:chromeOptions", "perfLoggingPrefs"],
    // https://developer.mozilla.org/en-US/docs/Web/WebDriver/Capabilities/firefoxOptions
    [types_1.BrowserName.FIREFOX]: ["moz:firefoxOptions"],
    // https://learn.microsoft.com/en-us/microsoft-edge/webdriver-chromium/capabilities-edge-options
    [types_1.BrowserName.EDGE]: ["ms:edgeOptions"],
    // https://developer.apple.com/documentation/webkit/about-webdriver-for-safari
    [types_1.BrowserName.SAFARI]: ["safari:automaticInspection", "safari:automaticProfiling", "useTechnologyPreview"],
};
//# sourceMappingURL=config.js.map