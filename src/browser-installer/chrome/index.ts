import { spawn, type ChildProcess } from "child_process";
import getPort from "get-port";
import waitPort from "wait-port";
import { pipeLogsWithPrefix } from "../../dev-server/utils";
import { DRIVER_WAIT_INTERVAL, DRIVER_WAIT_TIMEOUT } from "../constants";
import { getMilestone } from "../utils";
import { installChrome, resolveLatestChromeVersion } from "./browser";
import { installChromeDriver } from "./driver";
import { isUbuntu, getUbuntuLinkerEnv } from "../ubuntu-packages";
import RuntimeConfig from "../../config/runtime-config";

export { installChrome, resolveLatestChromeVersion, installChromeDriver };

export const runChromeDriver = async (
    chromeVersion: string,
    { debug = false } = {},
): Promise<{ gridUrl: string; process: ChildProcess; port: number; kill: () => void }> => {
    const [chromeDriverPath, randomPort, chromeDriverEnv] = await Promise.all([
        installChromeDriver(chromeVersion),
        getPort(),
        isUbuntu()
            .then(isUbuntu => (isUbuntu ? getUbuntuLinkerEnv() : null))
            .then(extraEnv => (extraEnv ? { ...process.env, ...extraEnv } : process.env)),
    ]);

    const runtimeConfig = RuntimeConfig.getInstance();
    const keepBrowserModeEnabled = runtimeConfig.keepBrowserMode.enabled;

    const chromeDriver = spawn(chromeDriverPath, [`--port=${randomPort}`, debug ? `--verbose` : "--silent"], {
        windowsHide: true,
        detached: keepBrowserModeEnabled || false,
        env: chromeDriverEnv,
    });

    if (debug) {
        pipeLogsWithPrefix(chromeDriver, `[chromedriver@${getMilestone(chromeVersion)}] `);
    }

    const gridUrl = `http://127.0.0.1:${randomPort}`;

    if (!keepBrowserModeEnabled) {
        process.once("exit", () => chromeDriver.kill());
    }

    await waitPort({
        port: randomPort,
        output: "silent",
        timeout: DRIVER_WAIT_TIMEOUT,
        interval: DRIVER_WAIT_INTERVAL,
    });

    return {
        gridUrl,
        process: chromeDriver,
        port: randomPort,
        kill: () => chromeDriver.kill(),
    };
};
