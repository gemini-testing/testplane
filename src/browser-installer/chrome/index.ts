import { spawn, type ChildProcess } from "child_process";
import getPort from "get-port";
import waitPort from "wait-port";
import { pipeLogsWithPrefix } from "../../dev-server/utils";
import { DRIVER_WAIT_TIMEOUT } from "../constants";
import { getMilestone } from "../utils";
import { installChrome } from "./browser";
import { installChromeDriver } from "./driver";
import { isUbuntu, getUbuntuLinkerEnv, installUbuntuPackageDependencies } from "../ubuntu-packages";

export { installChrome, installChromeDriver };

export const runChromeDriver = async (
    chromeVersion: string,
    { debug = false } = {},
): Promise<{ gridUrl: string; process: ChildProcess; port: number }> => {
    const shouldInstallUbuntuPackageDependencies = await isUbuntu();

    const [chromeDriverPath] = await Promise.all([
        installChromeDriver(chromeVersion),
        installChrome(chromeVersion),
        shouldInstallUbuntuPackageDependencies ? installUbuntuPackageDependencies() : null,
    ]);

    const milestone = getMilestone(chromeVersion);
    const randomPort = await getPort();
    const extraSpawnOpts = shouldInstallUbuntuPackageDependencies
        ? {
              env: {
                  ...process.env,
                  ...(await getUbuntuLinkerEnv()),
              },
          }
        : {};

    const chromeDriver = spawn(chromeDriverPath, [`--port=${randomPort}`, debug ? `--verbose` : "--silent"], {
        windowsHide: true,
        detached: false,
        ...extraSpawnOpts,
    });

    if (debug) {
        pipeLogsWithPrefix(chromeDriver, `[chromedriver@${milestone}] `);
    }

    const gridUrl = `http://127.0.0.1:${randomPort}`;

    process.once("exit", () => chromeDriver.kill());

    await waitPort({ port: randomPort, output: "silent", timeout: DRIVER_WAIT_TIMEOUT });

    return { gridUrl, process: chromeDriver, port: randomPort };
};
