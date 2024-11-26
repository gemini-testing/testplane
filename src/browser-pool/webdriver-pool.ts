import type { ChildProcess } from "child_process";
import { runBrowserDriver, getDriverNameForBrowserName } from "../browser-installer";
import type { SupportedBrowser, SupportedDriver } from "../browser-installer";

type DriverVersion = string;
type Port = string;
type ChildProcessWithStatus = { process: ChildProcess; gridUrl: string; isBusy: boolean };
export type WdProcess = { gridUrl: string; free: () => void; kill: () => void };

export class WebdriverPool {
    private driverProcess: Map<SupportedDriver, Map<DriverVersion, Record<Port, ChildProcessWithStatus>>>;
    private portToDriverProcess: Map<Port, ChildProcessWithStatus>;

    constructor() {
        this.driverProcess = new Map();
        this.portToDriverProcess = new Map();
    }

    async getWebdriver(
        browserName: SupportedBrowser,
        browserVersion: string,
        { debug = false } = {},
    ): ReturnType<typeof this.createWebdriverProcess> {
        const driverName = getDriverNameForBrowserName(browserName);

        if (!driverName) {
            throw new Error(
                [
                    `Couldn't run browser driver for "${browserName}", as this browser is not supported`,
                    `Supported browsers: "chrome", "firefox", "safari", "MicrosoftEdge"`,
                ].join("\n"),
            );
        }

        if (!browserVersion) {
            throw new Error(`Couldn't run browser driver for "${browserName}" because its version is undefined`);
        }

        const wdProcesses = this.driverProcess.get(driverName)?.get(browserVersion) ?? {};

        for (const port in wdProcesses) {
            if (!wdProcesses[port].isBusy) {
                wdProcesses[port].isBusy = true;

                return {
                    gridUrl: wdProcesses[port].gridUrl,
                    free: () => this.freeWebdriver(port),
                    kill: () => this.killWebdriver(driverName, browserVersion, port),
                };
            }
        }

        return this.createWebdriverProcess(driverName, browserVersion, { debug });
    }

    private freeWebdriver(port: Port): void {
        const wdProcess = this.portToDriverProcess.get(port);

        if (wdProcess) {
            wdProcess.isBusy = false;
        }
    }

    private killWebdriver(driverName: SupportedDriver, browserVersion: string, port: Port): void {
        const wdProcess = this.portToDriverProcess.get(port);
        const nodes = this.driverProcess.get(driverName)?.get(browserVersion);

        if (wdProcess && nodes) {
            wdProcess.process.kill();
            this.portToDriverProcess.delete(port);
            delete nodes[port];
        }
    }

    private async createWebdriverProcess(
        driverName: SupportedDriver,
        browserVersion: string,
        { debug = false } = {},
    ): Promise<WdProcess> {
        const driver = await runBrowserDriver(driverName, browserVersion, { debug });

        if (!this.driverProcess.has(driverName)) {
            this.driverProcess.set(driverName, new Map());
        }

        if (!this.driverProcess.get(driverName)?.has(browserVersion)) {
            this.driverProcess.get(driverName)?.set(browserVersion, {});
        }

        const nodes = this.driverProcess.get(driverName)?.get(browserVersion) as Record<Port, ChildProcessWithStatus>;
        const node = { process: driver.process, gridUrl: driver.gridUrl, isBusy: true };

        nodes[driver.port] = node;

        this.portToDriverProcess.set(String(driver.port), node);

        return {
            gridUrl: driver.gridUrl,
            free: () => this.freeWebdriver(String(driver.port)),
            kill: () => this.killWebdriver(driverName, browserVersion, String(driver.port)),
        };
    }
}
