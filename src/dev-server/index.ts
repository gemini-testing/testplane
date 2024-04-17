import _ from "lodash";
import { spawn } from "child_process";
import debug from "debug";
import { Config } from "../config";
import { findCwd, pipeLogsWithPrefix, waitDevServerReady } from "./utils";
import logger = require("../utils/logger");
import type { Hermione } from "../hermione";

export type DevServerOpts = { hermione: Hermione; devServerConfig: Config["devServer"]; configPath: string };

export type InitDevServer = (opts: DevServerOpts) => Promise<void>;

export const initDevServer: InitDevServer = async ({ hermione, devServerConfig, configPath }) => {
    if (!devServerConfig || !devServerConfig.command) {
        return;
    }

    logger.log("Starting dev server with command", `"${devServerConfig.command}"`);

    const debugLog = debug("hermione:dev-server");

    if (!_.isEmpty(devServerConfig.args)) {
        debugLog("Dev server args:", JSON.stringify(devServerConfig.args));
    }

    if (!_.isEmpty(devServerConfig.env)) {
        debugLog("Dev server env:", JSON.stringify(devServerConfig.env, null, 4));
    }

    const devServer = spawn(devServerConfig.command, devServerConfig.args, {
        env: { ...process.env, ...devServerConfig.env },
        cwd: devServerConfig.cwd || findCwd(configPath),
        shell: true,
        windowsHide: true,
    });

    if (devServerConfig.logs) {
        pipeLogsWithPrefix(devServer, "[dev server] ");
    }

    devServer.once("exit", (code, signal) => {
        if (signal !== "SIGINT") {
            const errorMessage = [
                "An error occured while launching dev server",
                `Dev server failed with code '${code}' (signal: ${signal})`,
            ].join("\n");
            hermione.halt(new Error(errorMessage), 5000);
        }
    });

    process.once("exit", () => {
        devServer.kill("SIGINT");
    });

    await waitDevServerReady(devServer, devServerConfig.readinessProbe);
};
