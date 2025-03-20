"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBrowserDriver = void 0;
const install_1 = require("./install");
const types_1 = require("../browser/types");
const runBrowserDriver = async (browserName, browserVersion, { debug = false } = {}) => {
    const installBrowserOpts = { shouldInstallWebDriver: true, shouldInstallUbuntuPackages: true };
    await (0, install_1.installBrowser)(browserName, browserVersion, installBrowserOpts);
    switch (browserName) {
        case types_1.BrowserName.CHROME:
        case types_1.BrowserName.CHROMIUM:
            return Promise.resolve().then(() => __importStar(require("./chrome"))).then(module => module.runChromeDriver(browserVersion, { debug }));
        case types_1.BrowserName.FIREFOX:
            return Promise.resolve().then(() => __importStar(require("./firefox"))).then(module => module.runGeckoDriver(browserVersion, { debug }));
        case types_1.BrowserName.EDGE:
            return Promise.resolve().then(() => __importStar(require("./edge"))).then(module => module.runEdgeDriver(browserVersion, { debug }));
        case types_1.BrowserName.SAFARI:
            return Promise.resolve().then(() => __importStar(require("./safari"))).then(module => module.runSafariDriver({ debug }));
        default:
            throw new Error(`Invalid browser: ${browserName}. Expected one of: ${Object.values(types_1.BrowserName).join(", ")}`);
    }
};
exports.runBrowserDriver = runBrowserDriver;
//# sourceMappingURL=run.js.map