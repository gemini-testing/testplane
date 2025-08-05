import { installEdgeDriver } from "./driver";
import { spawn, type ChildProcess } from "child_process";
import getPort from "get-port";
import waitPort from "wait-port";
import { pipeLogsWithPrefix } from "../../dev-server/utils";
import { DRIVER_WAIT_INTERVAL, DRIVER_WAIT_TIMEOUT } from "../constants";
import RuntimeConfig from "../../config/runtime-config";

export { resolveEdgeVersion } from "./browser";
export { installEdgeDriver };

export const runEdgeDriver = async (
    edgeVersion: string,
    { debug = false }: { debug?: boolean } = {},
): Promise<{ gridUrl: string; process: ChildProcess; port: number; kill: () => void }> => {
    const [edgeDriverPath, randomPort] = await Promise.all([installEdgeDriver(edgeVersion), getPort()]);

    const runtimeConfig = RuntimeConfig.getInstance();
    const keepBrowserModeEnabled = runtimeConfig.keepBrowserMode.enabled;

    const edgeDriver = spawn(edgeDriverPath, [`--port=${randomPort}`, debug ? `--verbose` : "--silent"], {
        windowsHide: true,
        detached: keepBrowserModeEnabled || false,
    });

    if (debug) {
        pipeLogsWithPrefix(edgeDriver, `[edgedriver@${edgeVersion}] `);
    }

    const gridUrl = `http://127.0.0.1:${randomPort}`;

    if (!keepBrowserModeEnabled) {
        process.once("exit", () => edgeDriver.kill());
    }

    await waitPort({
        port: randomPort,
        output: "silent",
        timeout: DRIVER_WAIT_TIMEOUT,
        interval: DRIVER_WAIT_INTERVAL,
    });

    return { gridUrl, process: edgeDriver, port: randomPort, kill: () => edgeDriver.kill() };
};
