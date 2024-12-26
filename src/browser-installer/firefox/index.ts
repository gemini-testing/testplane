import type { ChildProcess } from "child_process";
import { start as startGeckoDriver } from "geckodriver";
import getPort from "get-port";
import waitPort from "wait-port";
import { installFirefox, resolveLatestFirefoxVersion } from "./browser";
import { installLatestGeckoDriver } from "./driver";
import { pipeLogsWithPrefix } from "../../dev-server/utils";
import { DRIVER_WAIT_TIMEOUT } from "../constants";
import { getUbuntuLinkerEnv, isUbuntu } from "../ubuntu-packages";

export { installFirefox, resolveLatestFirefoxVersion, installLatestGeckoDriver };

export const runGeckoDriver = async (
    firefoxVersion: string,
    { debug = false } = {},
): Promise<{ gridUrl: string; process: ChildProcess; port: number }> => {
    const [geckoDriverPath, randomPort, geckoDriverEnv] = await Promise.all([
        installLatestGeckoDriver(firefoxVersion),
        getPort(),
        isUbuntu()
            .then(isUbuntu => (isUbuntu ? getUbuntuLinkerEnv() : null))
            .then(extraEnv => (extraEnv ? { ...process.env, ...extraEnv } : process.env)),
    ]);

    const geckoDriver = await startGeckoDriver({
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
        pipeLogsWithPrefix(geckoDriver, `[geckodriver@${firefoxVersion}] `);
    }

    const gridUrl = `http://127.0.0.1:${randomPort}`;

    process.once("exit", () => geckoDriver.kill());

    await waitPort({ port: randomPort, output: "silent", timeout: DRIVER_WAIT_TIMEOUT });

    return { gridUrl, process: geckoDriver, port: randomPort };
};
