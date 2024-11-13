import type { ChildProcess } from "child_process";
import { Driver, type SupportedDriver } from "./utils";

export const runBrowserDriver = async (
    driverName: SupportedDriver,
    browserVersion: string,
    { debug = false } = {},
): Promise<{ gridUrl: string; process: ChildProcess; port: number }> => {
    switch (driverName) {
        case Driver.CHROMEDRIVER:
            return import("./chrome").then(module => module.runChromeDriver(browserVersion, { debug }));
        case Driver.EDGEDRIVER:
            return import("./edge").then(module => module.runEdgeDriver(browserVersion, { debug }));
        case Driver.GECKODRIVER:
            return import("./firefox").then(module => module.runGeckoDriver(browserVersion, { debug }));
        case Driver.SAFARIDRIVER:
            return import("./safari").then(module => module.runSafariDriver({ debug }));
    }
};
