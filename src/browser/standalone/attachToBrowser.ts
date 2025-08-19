import { Config } from "../../config";
import { ExistingBrowser } from "./../existing-browser";
import { Calibrator } from "./../calibrator";
import { AsyncEmitter } from "../../events";
import { BrowserName, type W3CBrowserName, type SessionOptions } from "./../types";
import { getNormalizedBrowserName } from "../../utils/browser";
import { exec } from "child_process";

export async function attachToBrowser(session: SessionOptions): Promise<WebdriverIO.Browser> {
    const browserName = session.sessionCaps?.browserName || BrowserName.CHROME;
    const normalizedBrowserName = getNormalizedBrowserName(browserName) as W3CBrowserName;

    if (!normalizedBrowserName) {
        throw new Error(
            [
                `Running browser "${browserName}" is unsupported`,
                `Supported browsers: "chrome", "firefox", "safari", "edge"`,
            ].join("\n"),
        );
    }

    const browserConfig = {
        desiredCapabilities: {
            browserName,
        },
    };

    const config = new Config({
        browsers: {
            [browserName]: browserConfig,
        },
    });

    if (!process.env.WDIO_LOG_LEVEL) {
        process.env.WDIO_LOG_LEVEL = config.system.debug ? "trace" : "error";
    }

    const emitter = new AsyncEmitter();

    const existingBrowser = new ExistingBrowser(config, {
        id: browserName,
        version: session.sessionCaps?.browserVersion,
        emitter,
        state: {},
    });

    const calibrator = new Calibrator();

    await existingBrowser.init(session, calibrator);

    existingBrowser.publicAPI.overwriteCommand("deleteSession", async originalCommand => {
        await originalCommand({ shutdownDriver: true });

        // force delete driver process by port, because { shutdownDriver: true } in prev command doesn't work :(
        exec(
            process.platform === "win32"
                ? `Stop-Process -Id (Get-NetTCPConnection -LocalPort ${session.sessionOpts?.port}).OwningProcess -Force`
                : `kill -9 $(lsof -t -i :${session.sessionOpts?.port})`,
        );
    });

    return existingBrowser.publicAPI;
}
