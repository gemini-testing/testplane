import { spawn, type ChildProcess } from "child_process";
import getPort from "get-port";
import waitPort from "wait-port";
import { pipeLogsWithPrefix } from "../../dev-server/utils";
import { DRIVER_WAIT_TIMEOUT } from "../constants";
import { getMilestone } from "../utils";
import { installChrome, resolveLatestChromeVersion } from "./browser";
import { installChromeDriver } from "./driver";
import { isUbuntu, getUbuntuLinkerEnv } from "../ubuntu-packages";

export { installChrome, resolveLatestChromeVersion, installChromeDriver };

export const runChromeDriver = async (
    chromeVersion: string,
    { debug = false } = {},
): Promise<{ gridUrl: string; process: ChildProcess; port: number }> => {
    const [chromeDriverPath, randomPort, chromeDriverEnv] = await Promise.all([
        installChromeDriver(chromeVersion),
        getPort(),
        isUbuntu()
            .then(isUbuntu => (isUbuntu ? getUbuntuLinkerEnv() : null))
            .then(extraEnv => (extraEnv ? { ...process.env, ...extraEnv } : process.env)),
    ]);

    const chromeDriver = spawn(chromeDriverPath, [`--port=${randomPort}`, debug ? `--verbose` : "--silent"], {
        windowsHide: true,
        detached: false,
        env: chromeDriverEnv,
    });

    if (debug) {
        pipeLogsWithPrefix(chromeDriver, `[chromedriver@${getMilestone(chromeVersion)}] `);
    }

    const gridUrl = `http://127.0.0.1:${randomPort}`;

    process.once("exit", () => chromeDriver.kill());

    await waitPort({ port: randomPort, output: "silent", timeout: DRIVER_WAIT_TIMEOUT });

    return { gridUrl, process: chromeDriver, port: randomPort };
};
