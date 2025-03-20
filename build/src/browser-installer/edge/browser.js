"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveEdgeVersion = void 0;
const lodash_1 = __importDefault(require("lodash"));
const child_process_1 = require("child_process");
const browsers_1 = require("@puppeteer/browsers");
const utils_1 = require("../utils");
const extractBrowserVersion = (cmd) => new Promise((resolve, reject) => {
    (0, child_process_1.exec)(cmd, (err, stdout) => {
        if (err) {
            const errorMessage = "Couldn't retrive edge version. Looks like its not installed";
            reject(new Error(errorMessage));
            return;
        }
        const edgeVersionRegExp = /\d+\.\d+\.\d+\.\d+/;
        const version = edgeVersionRegExp.exec(stdout);
        if (version && version[0]) {
            resolve(version[0]);
        }
        else {
            const errorMessage = `Couldn't retrive edge version. Expected browser version, but got "${stdout}"`;
            reject(new Error(errorMessage));
        }
    });
});
const resolveLinuxEdgeVersion = () => {
    const getMsEdgeStableVersion = "which microsoft-edge-stable > /dev/null && microsoft-edge-stable --version";
    const getMsEdgeVersion = "which microsoft-edge > /dev/null && microsoft-edge --version";
    return extractBrowserVersion(`${getMsEdgeStableVersion} || ${getMsEdgeVersion}`);
};
const resolveWindowsEdgeVersion = () => {
    const getMsEdgeVersion = 'reg query "HKEY_CURRENT_USER\\Software\\Microsoft\\Edge\\BLBeacon" /v version';
    return extractBrowserVersion(getMsEdgeVersion);
};
const resolveMacEdgeVersion = () => {
    const getMsEdgeVersion = "/Applications/Microsoft\\ Edge.app/Contents/MacOS/Microsoft\\ Edge --version";
    return extractBrowserVersion(getMsEdgeVersion);
};
exports.resolveEdgeVersion = lodash_1.default.once(async () => {
    const platform = (0, utils_1.getBrowserPlatform)();
    switch (platform) {
        case browsers_1.BrowserPlatform.LINUX:
            return resolveLinuxEdgeVersion();
        case browsers_1.BrowserPlatform.WIN32:
        case browsers_1.BrowserPlatform.WIN64:
            return resolveWindowsEdgeVersion();
        case browsers_1.BrowserPlatform.MAC:
        case browsers_1.BrowserPlatform.MAC_ARM:
            return resolveMacEdgeVersion();
        default:
            throw new Error(`Unsupported platform: "${platform}"`);
    }
});
//# sourceMappingURL=browser.js.map