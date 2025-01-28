"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDevServer = void 0;
const lodash_1 = __importDefault(require("lodash"));
const child_process_1 = require("child_process");
const debug_1 = __importDefault(require("debug"));
const utils_1 = require("./utils");
const logger = require("../utils/logger");
const initDevServer = async ({ testplane, devServerConfig, configPath }) => {
    if (!devServerConfig || !devServerConfig.command) {
        return;
    }
    logger.log("Starting dev server with command", `"${devServerConfig.command}"`);
    const debugLog = (0, debug_1.default)("testplane:dev-server");
    if (!lodash_1.default.isEmpty(devServerConfig.args)) {
        debugLog("Dev server args:", JSON.stringify(devServerConfig.args));
    }
    if (!lodash_1.default.isEmpty(devServerConfig.env)) {
        debugLog("Dev server env:", JSON.stringify(devServerConfig.env, null, 4));
    }
    const devServer = (0, child_process_1.spawn)(devServerConfig.command, devServerConfig.args, {
        env: { ...process.env, ...devServerConfig.env },
        cwd: devServerConfig.cwd || (0, utils_1.findCwd)(configPath),
        shell: true,
        windowsHide: true,
    });
    if (devServerConfig.logs) {
        (0, utils_1.pipeLogsWithPrefix)(devServer, "[dev server] ");
    }
    devServer.once("exit", (code, signal) => {
        if (signal !== "SIGINT") {
            const errorMessage = [
                "An error occured while launching dev server",
                `Dev server failed with code '${code}' (signal: ${signal})`,
            ].join("\n");
            testplane.halt(new Error(errorMessage), 5000);
        }
    });
    process.once("exit", () => {
        devServer.kill("SIGINT");
    });
    await (0, utils_1.waitDevServerReady)(devServer, devServerConfig.readinessProbe);
};
exports.initDevServer = initDevServer;
//# sourceMappingURL=index.js.map