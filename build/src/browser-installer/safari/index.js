"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSafariDriver = exports.resolveSafariVersion = void 0;
const child_process_1 = require("child_process");
const get_port_1 = __importDefault(require("get-port"));
const wait_port_1 = __importDefault(require("wait-port"));
const utils_1 = require("../../dev-server/utils");
const constants_1 = require("../constants");
var browser_1 = require("./browser");
Object.defineProperty(exports, "resolveSafariVersion", { enumerable: true, get: function () { return browser_1.resolveSafariVersion; } });
const runSafariDriver = async ({ debug = false } = {}) => {
    const randomPort = await (0, get_port_1.default)();
    const safariDriver = (0, child_process_1.spawn)(constants_1.SAFARIDRIVER_PATH, [`--port=${randomPort}`], {
        windowsHide: true,
        detached: false,
    });
    if (debug) {
        (0, utils_1.pipeLogsWithPrefix)(safariDriver, `[safaridriver] `);
    }
    const gridUrl = `http://127.0.0.1:${randomPort}`;
    process.once("exit", () => safariDriver.kill());
    await (0, wait_port_1.default)({ port: randomPort, output: "silent", timeout: constants_1.DRIVER_WAIT_TIMEOUT });
    return { gridUrl, process: safariDriver, port: randomPort };
};
exports.runSafariDriver = runSafariDriver;
//# sourceMappingURL=index.js.map