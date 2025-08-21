import type { ChildProcess } from "child_process";
import { getNormalizedBrowserName } from "../utils/browser";
import type { SupportedBrowser } from "../browser-installer";

type BrowserVersion = string;
type Port = string;
type ChildProcessWithStatus = { process: ChildProcess; gridUrl: string; isBusy: boolean };
export type WdProcess = { gridUrl: string; free: () => void; kill: () => void; getPid: () => number | undefined };

export class WebdriverPool {
    private driverProcess: Map<SupportedBrowser, Map<BrowserVersion, Record<Port, ChildProcessWithStatus>>>;
    private portToDriverProcess: Map<Port, ChildProcessWithStatus>;

    constructor() {
        this.driverProcess = new Map();
        this.portToDriverProcess = new Map();
    }

    async getWebdriver(
        browserName?: string,
        browserVersion?: string,
        { debug = false } = {},
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

        const { resolveBrowserVersion } = await import("../browser-installer");
        const browserVersionNormalized = browserVersion || (await resolveBrowserVersion(browserNameNormalized));

        const wdProcesses = this.driverProcess.get(browserNameNormalized)?.get(browserVersionNormalized) ?? {};

        for (const port in wdProcesses) {
            if (!wdProcesses[port].isBusy) {
                wdProcesses[port].isBusy = true;

                return {
                    gridUrl: wdProcesses[port].gridUrl,
                    free: () => this.freeWebdriver(port),
                    kill: () => this.killWebdriver(browserNameNormalized, browserVersionNormalized, port),
                    getPid: () => wdProcesses[port].process.pid,
                };
            }
        }

        return this.createWebdriverProcess(browserNameNormalized, browserVersionNormalized, { debug });
    }

    private freeWebdriver(port: Port): void {
        const wdProcess = this.portToDriverProcess.get(port);

        if (wdProcess) {
            wdProcess.isBusy = false;
        }
    }

    private killWebdriver(browserName: SupportedBrowser, browserVersion: string, port: Port): void {
        const wdProcess = this.portToDriverProcess.get(port);
        const nodes = this.driverProcess.get(browserName)?.get(browserVersion);

        if (wdProcess && nodes) {
            wdProcess.process.kill();
            this.portToDriverProcess.delete(port);
            delete nodes[port];
        }
    }

    private async createWebdriverProcess(
        browserName: SupportedBrowser,
        browserVersion: string,
        { debug = false } = {},
    ): Promise<WdProcess> {
        const { runBrowserDriver } = await import("../browser-installer");
        const driver = await runBrowserDriver(browserName, browserVersion, { debug });

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

        return {
            gridUrl: driver.gridUrl,
            free: () => this.freeWebdriver(String(driver.port)),
            kill: () => this.killWebdriver(browserName, browserVersion, String(driver.port)),
            getPid: () => driver.process.pid,
        };
    }
}
