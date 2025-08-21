import { spawn, type ChildProcess } from "child_process";
import getPort from "get-port";
import waitPort from "wait-port";
import { pipeLogsWithPrefix } from "../../dev-server/utils";
import { DRIVER_WAIT_INTERVAL, DRIVER_WAIT_TIMEOUT, SAFARIDRIVER_PATH } from "../constants";
import RuntimeConfig from "../../config/runtime-config";

export { resolveSafariVersion } from "./browser";

export const runSafariDriver = async ({ debug = false }: { debug?: boolean } = {}): Promise<{
    gridUrl: string;
    process: ChildProcess;
    port: number;
    kill: () => void;
}> => {
    const randomPort = await getPort();

    const runtimeConfig = RuntimeConfig.getInstance();
    const keepBrowserModeEnabled = runtimeConfig.keepBrowserMode?.enabled;

    const safariDriver = spawn(SAFARIDRIVER_PATH, [`--port=${randomPort}`], {
        windowsHide: true,
        detached: keepBrowserModeEnabled || false,
    });

    if (debug) {
        pipeLogsWithPrefix(safariDriver, `[safaridriver] `);
    }

    const gridUrl = `http://127.0.0.1:${randomPort}`;

    if (!keepBrowserModeEnabled) {
        process.once("exit", () => safariDriver.kill());
    }

    await waitPort({
        port: randomPort,
        output: "silent",
        timeout: DRIVER_WAIT_TIMEOUT,
        interval: DRIVER_WAIT_INTERVAL,
    });

    return { gridUrl, process: safariDriver, port: randomPort, kill: () => safariDriver.kill() };
};
