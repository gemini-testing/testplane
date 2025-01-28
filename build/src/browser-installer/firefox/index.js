"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runGeckoDriver = exports.installLatestGeckoDriver = exports.resolveLatestFirefoxVersion = exports.installFirefox = void 0;
const geckodriver_1 = require("geckodriver");
const get_port_1 = __importDefault(require("get-port"));
const wait_port_1 = __importDefault(require("wait-port"));
const browser_1 = require("./browser");
Object.defineProperty(exports, "installFirefox", { enumerable: true, get: function () { return browser_1.installFirefox; } });
Object.defineProperty(exports, "resolveLatestFirefoxVersion", { enumerable: true, get: function () { return browser_1.resolveLatestFirefoxVersion; } });
const driver_1 = require("./driver");
Object.defineProperty(exports, "installLatestGeckoDriver", { enumerable: true, get: function () { return driver_1.installLatestGeckoDriver; } });
const utils_1 = require("../../dev-server/utils");
const constants_1 = require("../constants");
const ubuntu_packages_1 = require("../ubuntu-packages");
const runGeckoDriver = async (firefoxVersion, { debug = false } = {}) => {
    const [geckoDriverPath, randomPort, geckoDriverEnv] = await Promise.all([
        (0, driver_1.installLatestGeckoDriver)(firefoxVersion),
        (0, get_port_1.default)(),
        (0, ubuntu_packages_1.isUbuntu)()
            .then(isUbuntu => (isUbuntu ? (0, ubuntu_packages_1.getUbuntuLinkerEnv)() : null))
            .then(extraEnv => (extraEnv ? { ...process.env, ...extraEnv } : process.env)),
    ]);
    const geckoDriver = await (0, geckodriver_1.start)({
        customGeckoDriverPath: geckoDriverPath,
        port: randomPort,
        log: debug ? "debug" : "fatal",
        spawnOpts: {
            windowsHide: true,
            detached: false,
            env: geckoDriverEnv,
        },
    });
    if (debug) {
        (0, utils_1.pipeLogsWithPrefix)(geckoDriver, `[geckodriver@${firefoxVersion}] `);
    }
    const gridUrl = `http://127.0.0.1:${randomPort}`;
    process.once("exit", () => geckoDriver.kill());
    await (0, wait_port_1.default)({ port: randomPort, output: "silent", timeout: constants_1.DRIVER_WAIT_TIMEOUT });
    return { gridUrl, process: geckoDriver, port: randomPort };
};
exports.runGeckoDriver = runGeckoDriver;
//# sourceMappingURL=index.js.map