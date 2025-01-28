"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebdriverPool = void 0;
const browser_installer_1 = require("../browser-installer");
const browser_1 = require("../utils/browser");
class WebdriverPool {
    constructor() {
        this.driverProcess = new Map();
        this.portToDriverProcess = new Map();
    }
    async getWebdriver(browserName, browserVersion, { debug = false } = {}) {
        const browserNameNormalized = (0, browser_1.getNormalizedBrowserName)(browserName);
        if (!browserNameNormalized) {
            throw new Error([
                `Couldn't run browser driver for "${browserName}", as this browser is not supported`,
                `Supported browsers: "chrome", "firefox", "safari", "MicrosoftEdge"`,
            ].join("\n"));
        }
        const browserVersionNormalized = browserVersion || (await (0, browser_installer_1.resolveBrowserVersion)(browserNameNormalized));
        const wdProcesses = this.driverProcess.get(browserNameNormalized)?.get(browserVersionNormalized) ?? {};
        for (const port in wdProcesses) {
            if (!wdProcesses[port].isBusy) {
                wdProcesses[port].isBusy = true;
                return {
                    gridUrl: wdProcesses[port].gridUrl,
                    free: () => this.freeWebdriver(port),
                    kill: () => this.killWebdriver(browserNameNormalized, browserVersionNormalized, port),
                };
            }
        }
        return this.createWebdriverProcess(browserNameNormalized, browserVersionNormalized, { debug });
    }
    freeWebdriver(port) {
        const wdProcess = this.portToDriverProcess.get(port);
        if (wdProcess) {
            wdProcess.isBusy = false;
        }
    }
    killWebdriver(browserName, browserVersion, port) {
        const wdProcess = this.portToDriverProcess.get(port);
        const nodes = this.driverProcess.get(browserName)?.get(browserVersion);
        if (wdProcess && nodes) {
            wdProcess.process.kill();
            this.portToDriverProcess.delete(port);
            delete nodes[port];
        }
    }
    async createWebdriverProcess(browserName, browserVersion, { debug = false } = {}) {
        const driver = await (0, browser_installer_1.runBrowserDriver)(browserName, browserVersion, { debug });
        if (!this.driverProcess.has(browserName)) {
            this.driverProcess.set(browserName, new Map());
        }
        if (!this.driverProcess.get(browserName)?.has(browserVersion)) {
            this.driverProcess.get(browserName)?.set(browserVersion, {});
        }
        const nodes = this.driverProcess.get(browserName)?.get(browserVersion);
        const node = { process: driver.process, gridUrl: driver.gridUrl, isBusy: true };
        nodes[driver.port] = node;
        this.portToDriverProcess.set(String(driver.port), node);
        return {
            gridUrl: driver.gridUrl,
            free: () => this.freeWebdriver(String(driver.port)),
            kill: () => this.killWebdriver(browserName, browserVersion, String(driver.port)),
        };
    }
}
exports.WebdriverPool = WebdriverPool;
//# sourceMappingURL=webdriver-pool.js.map