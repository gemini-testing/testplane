"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNormalizedBrowserName = exports.isSupportIsolation = void 0;
const types_1 = require("../browser/types");
const browser_1 = require("../constants/browser");
const isSupportIsolation = (browserName, browserVersion = "") => {
    const browserVersionMajor = browserVersion.split(".")[0];
    return browserName === "chrome" && Number(browserVersionMajor) >= browser_1.MIN_CHROME_VERSION_SUPPORT_ISOLATION;
};
exports.isSupportIsolation = isSupportIsolation;
const getNormalizedBrowserName = (browserName) => {
    if (!browserName) {
        return null;
    }
    if (/chrome/i.test(browserName)) {
        return types_1.BrowserName.CHROME;
    }
    if (/firefox/i.test(browserName)) {
        return types_1.BrowserName.FIREFOX;
    }
    if (/edge/i.test(browserName)) {
        return types_1.BrowserName.EDGE;
    }
    if (/safari/i.test(browserName)) {
        return types_1.BrowserName.SAFARI;
    }
    return null;
};
exports.getNormalizedBrowserName = getNormalizedBrowserName;
//# sourceMappingURL=browser.js.map