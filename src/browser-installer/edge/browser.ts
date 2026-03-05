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

        default: {
            const lines: string[] = [];

            lines.push(`Cannot detect the installed Edge version: unsupported platform "${platform}".`);
            lines.push(
                "\nTestplane can only detect Edge on Linux, macOS, and Windows.",
                `The current platform "${platform}" is not in the supported list.`,
            );

            lines.push(
                "\nWhat you can do:",
                "- Run tests on a supported platform (Linux, macOS, or Windows)",
                "- Set the Edge version explicitly in your config (e.g. browserVersion: '120') instead of relying on auto-detection",
            );

            throw new Error(lines.join("\n"));
        }
    }
});
