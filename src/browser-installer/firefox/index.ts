import type { ChildProcess } from "child_process";
import { start as startGeckoDriver } from "geckodriver";
import getPort from "get-port";
import waitPort from "wait-port";
import { installFirefox, resolveLatestFirefoxVersion } from "./browser";
import { installLatestGeckoDriver } from "./driver";
import { pipeLogsWithPrefix } from "../../dev-server/utils";
import { DRIVER_WAIT_INTERVAL, DRIVER_WAIT_TIMEOUT } from "../constants";
import { getUbuntuLinkerEnv, isUbuntu } from "../ubuntu-packages";
import RuntimeConfig from "../../config/runtime-config";

export { installFirefox, resolveLatestFirefoxVersion, installLatestGeckoDriver };

export const runGeckoDriver = async (
    firefoxVersion: string,
    { debug = false } = {},
): Promise<{ gridUrl: string; process: ChildProcess; port: number; kill: () => void }> => {
    const [geckoDriverPath, randomPort, geckoDriverEnv] = await Promise.all([
        installLatestGeckoDriver(firefoxVersion),
        getPort(),
        isUbuntu()
            .then(isUbuntu => (isUbuntu ? getUbuntuLinkerEnv() : null))
            .then(extraEnv => (extraEnv ? { ...process.env, ...extraEnv } : process.env)),
    ]);

    const runtimeConfig = RuntimeConfig.getInstance();
    const keepBrowserModeEnabled = runtimeConfig.keepBrowserMode.enabled;

    const geckoDriver = await startGeckoDriver({
        customGeckoDriverPath: geckoDriverPath,
        port: randomPort,
        log: debug ? "debug" : "fatal",
        spawnOpts: {
            windowsHide: true,
            detached: keepBrowserModeEnabled || false,
            env: geckoDriverEnv,
        },
    });

    if (debug) {
        pipeLogsWithPrefix(geckoDriver, `[geckodriver@${firefoxVersion}] `);
    }

    const gridUrl = `http://127.0.0.1:${randomPort}`;

    if (!keepBrowserModeEnabled) {
        process.once("exit", () => geckoDriver.kill());
    }

    await waitPort({
        port: randomPort,
        output: "silent",
        timeout: DRIVER_WAIT_TIMEOUT,
        interval: DRIVER_WAIT_INTERVAL,
    });

    return { gridUrl, process: geckoDriver, port: randomPort, kill: () => geckoDriver.kill() };
};
