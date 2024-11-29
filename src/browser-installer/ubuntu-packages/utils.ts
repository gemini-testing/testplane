import { exec } from "child_process";
import fs from "fs";
import { browserInstallerDebug } from "../utils";

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
        throw new Error(`"${OS_RELEASE_PATH}" is missing. Probably its not Linux`);
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

let isUbuntuCached: boolean | null = null;

export const isUbuntu = async (): Promise<boolean> => {
    if (isUbuntuCached !== null) {
        return isUbuntuCached;
    }

    isUbuntuCached = await osRelease()
        .then(release => release.ID === "ubuntu")
        .catch(() => false);

    return isUbuntuCached;
};

export const getUbuntuMilestone = async (): Promise<string> => {
    const release = await osRelease();

    if (!release.VERSION_ID) {
        throw new Error(`VERSION_ID is missing in ${OS_RELEASE_PATH}. Probably its not Ubuntu`);
    }

    return release.VERSION_ID.split(".")[0] as string;
};
