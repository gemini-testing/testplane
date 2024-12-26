import _ from "lodash";
import { exec } from "child_process";
import { BrowserPlatform } from "@puppeteer/browsers";
import { getBrowserPlatform } from "../utils";

const extractBrowserVersion = (cmd: string): Promise<string> =>
    new Promise<string>((resolve, reject) => {
        exec(cmd, (err, stdout) => {
            if (err) {
                const errorMessage = "Couldn't retrive edge version. Looks like its not installed";

                reject(new Error(errorMessage));

                return;
            }

            const edgeVersionRegExp = /\d+\.\d+\.\d+\.\d+/;
            const version = edgeVersionRegExp.exec(stdout);

            if (version && version[0]) {
                resolve(version[0]);
            } else {
                const errorMessage = `Couldn't retrive edge version. Expected browser version, but got "${stdout}"`;

                reject(new Error(errorMessage));
            }
        });
    });

const resolveLinuxEdgeVersion = (): Promise<string> => {
    const getMsEdgeStableVersion = "which microsoft-edge-stable > /dev/null && microsoft-edge-stable --version";
    const getMsEdgeVersion = "which microsoft-edge > /dev/null && microsoft-edge --version";

    return extractBrowserVersion(`${getMsEdgeStableVersion} || ${getMsEdgeVersion}`);
};

const resolveWindowsEdgeVersion = (): Promise<string> => {
    const getMsEdgeVersion = 'reg query "HKEY_CURRENT_USER\\Software\\Microsoft\\Edge\\BLBeacon" /v version';

    return extractBrowserVersion(getMsEdgeVersion);
};

const resolveMacEdgeVersion = (): Promise<string> => {
    const getMsEdgeVersion = "/Applications/Microsoft\\ Edge.app/Contents/MacOS/Microsoft\\ Edge --version";

    return extractBrowserVersion(getMsEdgeVersion);
};

export const resolveEdgeVersion = _.once(async () => {
    const platform = getBrowserPlatform();

    switch (platform) {
        case BrowserPlatform.LINUX:
            return resolveLinuxEdgeVersion();

        case BrowserPlatform.WIN32:
        case BrowserPlatform.WIN64:
            return resolveWindowsEdgeVersion();

        case BrowserPlatform.MAC:
        case BrowserPlatform.MAC_ARM:
            return resolveMacEdgeVersion();

        default:
            throw new Error(`Unsupported platform: "${platform}"`);
    }
});
