import _ from "lodash";
import { spawn } from "child_process";
import debug from "debug";
import { Config } from "../config";
import { findCwd, pipeLogsWithPrefix, probeServer, waitDevServerReady } from "./utils";
import * as logger from "../utils/logger";
import type { Testplane } from "../testplane";

export type DevServerOpts = { testplane: Testplane; devServerConfig: Config["devServer"]; configPath: string };

export type InitDevServer = (opts: DevServerOpts) => Promise<void>;

export const initDevServer: InitDevServer = async ({ testplane, devServerConfig, configPath }) => {
    if (!devServerConfig || !devServerConfig.command) {
        return;
    }

    if (devServerConfig.reuseExisting) {
        if (typeof devServerConfig.readinessProbe === "function" || !devServerConfig.readinessProbe.url) {
            throw new Error(
                "When 'reuseExisting' option is set in 'devServer' config, it is required to set 'devServer.readinessProbe.url' option",
            );
        }

        const isReady = await probeServer(devServerConfig.readinessProbe);

        if (isReady) {
            logger.log("Reusing existing dev server");

            return;
        }
    }

    logger.log("Starting dev server with command", `"${devServerConfig.command}"`);

    const debugLog = debug("testplane:dev-server");

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

    const killDevServerOnProcessExitCb = (): void => {
        devServer.kill("SIGINT");
    };

    process.on("exit", killDevServerOnProcessExitCb);

    devServer.once("exit", (code, signal) => {
        process.removeListener("exit", killDevServerOnProcessExitCb);

        if (signal !== "SIGINT") {
            const errorMessage = [
                "An error occured while launching dev server",
                `Dev server failed with code '${code}' (signal: ${signal})`,
            ].join("\n");
            testplane.halt(new Error(errorMessage), 5000);
        }
    });

    await waitDevServerReady(devServer, devServerConfig.readinessProbe);
};
