import { spawn, type ChildProcess } from "child_process";
import getPort from "get-port";
import waitPort from "wait-port";
import { pipeLogsWithPrefix } from "../../dev-server/utils";
import { DRIVER_WAIT_TIMEOUT, SAFARIDRIVER_PATH } from "../constants";

export const runSafariDriver = async ({ debug = false }: { debug?: boolean } = {}): Promise<{
    gridUrl: string;
    process: ChildProcess;
    port: number;
}> => {
    const randomPort = await getPort();

    const safariDriver = spawn(SAFARIDRIVER_PATH, [`--port=${randomPort}`], {
        windowsHide: true,
        detached: false,
    });

    if (debug) {
        pipeLogsWithPrefix(safariDriver, `[safaridriver] `);
    }

    const gridUrl = `http://127.0.0.1:${randomPort}`;

    process.once("exit", () => safariDriver.kill());

    await waitPort({ port: randomPort, output: "silent", timeout: DRIVER_WAIT_TIMEOUT });

    return { gridUrl, process: safariDriver, port: randomPort };
};
