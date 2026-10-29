import type { ChildProcess } from "child_process";
import { once } from "events";
import { getNormalizedBrowserName } from "../../utils/browser";
import type { SupportedBrowser } from "../../browser-installer";
import type { BrowserDownloadMirrors } from "../../config/types";

type BrowserVersion = string;
type Port = string;
type ChildProcessWithStatus = { process: ChildProcess; gridUrl: string; isBusy: boolean };
export interface WdProcess extends AsyncDisposable {
    gridUrl: string;
    free: () => void | Promise<void>;
    getPid: () => number | undefined;
}

export class WebdriverPool implements AsyncDisposable {
    private driverProcess: Map<SupportedBrowser, Map<BrowserVersion, Record<Port, ChildProcessWithStatus>>>;
    private portToDriverProcess: Map<Port, ChildProcessWithStatus>;

    constructor() {
        this.driverProcess = new Map();
        this.portToDriverProcess = new Map();
    }

    async getWebdriver(
        browserName?: string,
        browserVersion?: string,
        {
            debug = false,
            browserDownloadMirrors,
        }: { debug?: boolean; browserDownloadMirrors?: BrowserDownloadMirrors } = {},
    ): ReturnType<typeof this.createWebdriverProcess> {
        const browserNameNormalized = getNormalizedBrowserName(browserName);

        if (!browserNameNormalized) {
            throw new Error(
                [
                    `Couldn't run browser driver for "${browserName}", as this browser is not supported`,
                    `Supported browsers: "chrome", "firefox", "safari", "MicrosoftEdge"`,
                ].join("\n"),
            );
        }

        const { resolveBrowserVersion } = await import("../../browser-installer");
        const browserVersionNormalized =
            browserVersion || (await resolveBrowserVersion(browserNameNormalized, { browserDownloadMirrors }));

        const wdProcesses = this.driverProcess.get(browserNameNormalized)?.get(browserVersionNormalized) ?? {};

        for (const port in wdProcesses) {
            if (!wdProcesses[port].isBusy) {
                wdProcesses[port].isBusy = true;

                return {
                    gridUrl: wdProcesses[port].gridUrl,
                    free: () => this.freeWebdriver(port),
                    [Symbol.asyncDispose]: () =>
                        this.killWebdriver(browserNameNormalized, browserVersionNormalized, port),
                    getPid: () => wdProcesses[port].process.pid,
                };
            }
        }

        return this.createWebdriverProcess(browserNameNormalized, browserVersionNormalized, {
            debug,
            browserDownloadMirrors,
        });
    }

    private freeWebdriver(port: Port): void {
        const wdProcess = this.portToDriverProcess.get(port);

        if (wdProcess) {
            wdProcess.isBusy = false;
        }
    }

    private async killWebdriver(browserName: SupportedBrowser, browserVersion: string, port: Port): Promise<void> {
        const wdProcess = this.portToDriverProcess.get(port);
        const nodes = this.driverProcess.get(browserName)?.get(browserVersion);

        if (wdProcess && nodes) {
            this.portToDriverProcess.delete(port);
            delete nodes[port];
            await stopProcess(wdProcess.process);
        }
    }

    private async createWebdriverProcess(
        browserName: SupportedBrowser,
        browserVersion: string,
        {
            debug = false,
            browserDownloadMirrors,
        }: { debug?: boolean; browserDownloadMirrors?: BrowserDownloadMirrors } = {},
    ): Promise<WdProcess> {
        const { runBrowserDriver } = await import("../../browser-installer");
        const driver = await runBrowserDriver(browserName, browserVersion, {
            debug,
            browserDownloadMirrors,
        });

        if (!this.driverProcess.has(browserName)) {
            this.driverProcess.set(browserName, new Map());
        }

        if (!this.driverProcess.get(browserName)?.has(browserVersion)) {
            this.driverProcess.get(browserName)?.set(browserVersion, {});
        }

        const nodes = this.driverProcess.get(browserName)?.get(browserVersion) as Record<Port, ChildProcessWithStatus>;
        const node = { process: driver.process, gridUrl: driver.gridUrl, isBusy: true };

        nodes[driver.port] = node;

        this.portToDriverProcess.set(String(driver.port), node);
        driver.process.once("exit", () => {
            if (this.portToDriverProcess.get(String(driver.port)) === node) {
                this.portToDriverProcess.delete(String(driver.port));
                delete nodes[driver.port];
            }
        });

        return {
            gridUrl: driver.gridUrl,
            free: () => this.freeWebdriver(String(driver.port)),
            [Symbol.asyncDispose]: () => this.killWebdriver(browserName, browserVersion, String(driver.port)),
            getPid: () => driver.process.pid,
        };
    }

    async [Symbol.asyncDispose](): Promise<void> {
        const processes = [...this.portToDriverProcess.values()];
        this.portToDriverProcess.clear();
        this.driverProcess.clear();
        await Promise.all(processes.map(({ process }) => stopProcess(process)));
    }
}

async function stopProcess(process: ChildProcess): Promise<void> {
    if (process.exitCode !== null || process.signalCode !== null) return;
    const exited = once(process, "exit");
    const timeout = setTimeout(() => process.kill("SIGKILL"), 5_000);
    try {
        process.kill();
        await exited;
    } finally {
        clearTimeout(timeout);
    }
}
