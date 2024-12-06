import { installEdgeDriver } from "./driver";
import { spawn, type ChildProcess } from "child_process";
import getPort from "get-port";
import waitPort from "wait-port";
import { pipeLogsWithPrefix } from "../../dev-server/utils";
import { DRIVER_WAIT_TIMEOUT } from "../constants";

export { installEdgeDriver };

export const runEdgeDriver = async (
    edgeVersion: string,
    { debug = false }: { debug?: boolean } = {},
): Promise<{ gridUrl: string; process: ChildProcess; port: number }> => {
    const [edgeDriverPath, randomPort] = await Promise.all([installEdgeDriver(edgeVersion), getPort()]);

    const edgeDriver = spawn(edgeDriverPath, [`--port=${randomPort}`, debug ? `--verbose` : "--silent"], {
        windowsHide: true,
        detached: false,
    });

    if (debug) {
        pipeLogsWithPrefix(edgeDriver, `[edgedriver@${edgeVersion}] `);
    }

    const gridUrl = `http://127.0.0.1:${randomPort}`;

    process.once("exit", () => edgeDriver.kill());

    await waitPort({ port: randomPort, output: "silent", timeout: DRIVER_WAIT_TIMEOUT });

    return { gridUrl, process: edgeDriver, port: randomPort };
};
