import { Config } from "../../config";
import { ExistingBrowser } from "./../existing-browser";
import { Calibrator } from "./../calibrator";
import { AsyncEmitter, MasterEvents } from "../../events";
import { BrowserName, type W3CBrowserName, type SessionOptions } from "./../types";
import { getNormalizedBrowserName } from "../../utils/browser";
import fs from "fs-extra";

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

    const filesToRemove: string[] = [];

    const config = new Config({
        browsers: {
            [browserName]: browserConfig,
        },
    });

    if (!process.env.WDIO_LOG_LEVEL) {
        process.env.WDIO_LOG_LEVEL = config.system.debug ? "trace" : "error";
    }

    const emitter = new AsyncEmitter();

    emitter.on(MasterEvents.ADD_FILE_TO_REMOVE, (path: string) => {
        filesToRemove.push(path);
    });

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

        // force kill driver process by pid, because { shutdownDriver: true } in prev command doesn't work :(
        if (session.driverPid) {
            process.kill(session.driverPid, 9);
        }

        if (filesToRemove.length > 0) {
            await Promise.all(filesToRemove.map(path => fs.remove(path)));
        }
    });

    return existingBrowser.publicAPI;
}
