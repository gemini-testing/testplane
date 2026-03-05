import _ from "lodash";
import { exec } from "child_process";
import fs from "fs";
import { browserInstallerDebug } from "../utils";
import { LINUX_UBUNTU_RELEASE_ID } from "../constants";

/** @link https://manpages.org/os-release/5 */
const OS_RELEASE_PATH = "/etc/os-release";

type OsRelease = {
    // General OS identification
    NAME: string;
    ID: string;
    PRETTY_NAME: string;
    ID_LIKE?: string;
    CPE_NAME?: string;
    VARIANT?: string;
    VARIANT_ID?: string;
    // Version identification
    VERSION?: string;
    VERSION_ID?: string;
    VERSION_CODENAME?: string;
    BUILD_ID?: string;
    IMAGE_ID?: string;
};

/** @link https://manpages.org/which */
export const ensureUnixBinaryExists = (binaryName: string): Promise<void> =>
    new Promise<void>((resolve, reject) =>
        exec(`which "${binaryName}"`, err => {
            browserInstallerDebug(`Checking binary "${binaryName}" is installed: ${!err}`);

            if (err) {
                reject(new Error(`Binary "${binaryName}" does not exist`));
            } else {
                resolve();
            }
        }),
    );

/** @link https://manpages.org/os-release/5 */
const osRelease = async (): Promise<OsRelease> => {
    if (!fs.existsSync(OS_RELEASE_PATH)) {
        const lines: string[] = [];

        lines.push(`OS identification file not found: ${OS_RELEASE_PATH}`);
        lines.push(
            "\nThis file is required to detect the current Linux distribution.",
            "It is missing from the current environment, which means this is likely not a standard Linux system.",
        );

        lines.push(
            "\nPossible reasons:",
            "- You are running on macOS or Windows, where Ubuntu package dependencies are not needed",
            "- You are in a minimal or custom container without standard OS identification files",
        );

        lines.push(
            "\nWhat you can do:",
            "- You can safely disable Ubuntu package installation by not passing 'needUbuntuPackages: true' in your config",
            "- If you are on Ubuntu and see this unexpectedly, ensure the container has /etc/os-release present",
        );

        throw new Error(lines.join("\n"));
    }

    const fileContents = await fs.promises.readFile(OS_RELEASE_PATH, "utf8");
    const result = {} as OsRelease;

    for (const line of fileContents.split("\n")) {
        if (!line.includes("=")) {
            continue;
        }

        const splitPosition = line.indexOf("=");
        const key = line.slice(0, splitPosition) as keyof OsRelease;
        const value = line.slice(splitPosition + 1);
        const valueIsWrappedWithQuotes = value.startsWith('"') && value.endsWith('"');

        result[key] = valueIsWrappedWithQuotes ? value.slice(1, -1) : value;
    }

    return result;
};

const osReleaseCached = _.once(osRelease);

export const isUbuntu = async (): Promise<boolean> => {
    return osReleaseCached()
        .then(release => release.ID === LINUX_UBUNTU_RELEASE_ID)
        .catch(() => false);
};

export const getUbuntuMilestone = async (): Promise<string> => {
    const release = await osReleaseCached();

    if (!release.VERSION_ID) {
        const lines: string[] = [];

        lines.push(`Cannot determine Ubuntu version: VERSION_ID is missing in ${OS_RELEASE_PATH}.`);
        lines.push(
            "\nTestplane reads /etc/os-release to find the Ubuntu version for downloading compatible browser packages.",
            "The VERSION_ID field is absent, which usually means this is not an Ubuntu system.",
        );

        lines.push(
            "\nPossible reasons:",
            "- You are on a non-Ubuntu Linux distribution (e.g. Alpine, Arch, Fedora)",
            "- You are on a minimal container image where /etc/os-release is incomplete",
        );

        lines.push(
            "\nWhat you can do:",
            "- Ubuntu package installation is only supported on Ubuntu 20, 22, and 24",
            "- On other distributions, install the required browser system libraries manually",
            "- Disable Ubuntu package installation by not passing 'needUbuntuPackages: true' in your config",
        );

        throw new Error(lines.join("\n"));
    }

    return release.VERSION_ID.split(".")[0] as string;
};
