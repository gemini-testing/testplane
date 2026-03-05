import { Config } from "../../config";
import { ExistingBrowser } from "./../existing-browser";
import { Calibrator } from "./../calibrator";
import { AsyncEmitter, MasterEvents } from "../../events";
import { BrowserName, type W3CBrowserName, type SessionOptions } from "./../types";
import { getNormalizedBrowserName } from "../../utils/browser";
import fs from "fs-extra";
import { hasGlobalFilesToRemove } from "../../globalFilesToRemove";

export async function attachToBrowser(session: SessionOptions): Promise<WebdriverIO.Browser> {
    const browserName = session.sessionCaps?.browserName || BrowserName.CHROME;
    const normalizedBrowserName = getNormalizedBrowserName(browserName) as W3CBrowserName;

    if (!normalizedBrowserName) {
        const lines: string[] = [];

        lines.push(`Cannot attach to browser: "${browserName}" is not supported.`);
        lines.push(
            `\nTestplane does not recognize the browser name "${browserName}" from the session capabilities.`,
            `Supported browser names: "chrome", "firefox", "safari", "edge"`,
        );

        lines.push(
            "\nWhat you can do:",
            `- Ensure the session was started with a supported browser`,
            `- Check the 'sessionCaps.browserName' value passed to attachToBrowser()`,
        );

        throw new Error(lines.join("\n"));
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

        if (filesToRemove.length > 0 && !hasGlobalFilesToRemove()) {
            await Promise.all(filesToRemove.map(path => fs.remove(path)));
        }
    });

    return existingBrowser.publicAPI;
}
