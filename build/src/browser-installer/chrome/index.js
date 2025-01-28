"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runChromeDriver = exports.installChromeDriver = exports.resolveLatestChromeVersion = exports.installChrome = void 0;
const child_process_1 = require("child_process");
const get_port_1 = __importDefault(require("get-port"));
const wait_port_1 = __importDefault(require("wait-port"));
const utils_1 = require("../../dev-server/utils");
const constants_1 = require("../constants");
const utils_2 = require("../utils");
const browser_1 = require("./browser");
Object.defineProperty(exports, "installChrome", { enumerable: true, get: function () { return browser_1.installChrome; } });
Object.defineProperty(exports, "resolveLatestChromeVersion", { enumerable: true, get: function () { return browser_1.resolveLatestChromeVersion; } });
const driver_1 = require("./driver");
Object.defineProperty(exports, "installChromeDriver", { enumerable: true, get: function () { return driver_1.installChromeDriver; } });
const ubuntu_packages_1 = require("../ubuntu-packages");
const runChromeDriver = async (chromeVersion, { debug = false } = {}) => {
    const [chromeDriverPath, randomPort, chromeDriverEnv] = await Promise.all([
        (0, driver_1.installChromeDriver)(chromeVersion),
        (0, get_port_1.default)(),
        (0, ubuntu_packages_1.isUbuntu)()
            .then(isUbuntu => (isUbuntu ? (0, ubuntu_packages_1.getUbuntuLinkerEnv)() : null))
            .then(extraEnv => (extraEnv ? { ...process.env, ...extraEnv } : process.env)),
    ]);
    const chromeDriver = (0, child_process_1.spawn)(chromeDriverPath, [`--port=${randomPort}`, debug ? `--verbose` : "--silent"], {
        windowsHide: true,
        detached: false,
        env: chromeDriverEnv,
    });
    if (debug) {
        (0, utils_1.pipeLogsWithPrefix)(chromeDriver, `[chromedriver@${(0, utils_2.getMilestone)(chromeVersion)}] `);
    }
    const gridUrl = `http://127.0.0.1:${randomPort}`;
    process.once("exit", () => chromeDriver.kill());
    await (0, wait_port_1.default)({ port: randomPort, output: "silent", timeout: constants_1.DRIVER_WAIT_TIMEOUT });
    return { gridUrl, process: chromeDriver, port: randomPort };
};
exports.runChromeDriver = runChromeDriver;
//# sourceMappingURL=index.js.map