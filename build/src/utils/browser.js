"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSupportIsolation = void 0;
const browser_1 = require("../constants/browser");
const isSupportIsolation = (browserName, browserVersion = "") => {
    const browserVersionMajor = browserVersion.split(".")[0];
    return browserName === "chrome" && Number(browserVersionMajor) >= browser_1.MIN_CHROME_VERSION_SUPPORT_ISOLATION;
};
exports.isSupportIsolation = isSupportIsolation;
//# sourceMappingURL=browser.js.map