import { download as downloadEdgeDriver } from "edgedriver";
import {
    DriverName,
    browserInstallerDebug,
    getBrowserPlatform,
    getEdgeDriverDir,
    getMilestone,
    retryFetch,
} from "../utils";
import registry from "../registry";
import { MIN_EDGEDRIVER_VERSION, MSEDGEDRIVER_API } from "../constants";

const getLatestMajorEdgeDriverVersion = async (milestone: string): Promise<string> => {
    const fullVersion = await retryFetch(`${MSEDGEDRIVER_API}/LATEST_RELEASE_${milestone}`).then(res => res.text());

    if (!fullVersion) {
        const lines: string[] = [];

        lines.push(`Failed to resolve EdgeDriver version for Edge@${milestone}.`);
        lines.push(
            "\nTestplane tried to fetch the EdgeDriver version from:",
            `  ${MSEDGEDRIVER_API}/LATEST_RELEASE_${milestone}`,
            "but received an empty response.",
        );

        lines.push(
            "\nPossible reasons:",
            `- Edge milestone '${milestone}' may not have a corresponding EdgeDriver release yet`,
            "- The Microsoft EdgeDriver API is temporarily unavailable",
            "- Network connectivity or proxy issues",
        );

        lines.push(
            "\nWhat you can do:",
            "- Check available EdgeDriver versions at: https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/",
            "- Verify your network can reach msedgedriver.azureedge.net",
            "- Try a different Edge milestone version",
        );

        throw new Error(lines.join("\n"));
    }

    const versionNormalized = fullVersion
        .split("")
        .filter(char => /\.|\d/.test(char))
        .join("");

    browserInstallerDebug(`resolved latest edgedriver@${milestone} version: ${versionNormalized}`);

    return versionNormalized;
};

export const installEdgeDriver = async (edgeVersion: string, { force = false } = {}): Promise<string> => {
    const platform = getBrowserPlatform();
    const existingLocallyDriverVersion = registry.getMatchedDriverVersion(DriverName.EDGEDRIVER, platform, edgeVersion);

    if (existingLocallyDriverVersion && !force) {
        browserInstallerDebug(
            `A locally installed edgedriver for edge@${edgeVersion} browser was found. Skipping the installation`,
        );

        return registry.getBinaryPath(DriverName.EDGEDRIVER, platform, existingLocallyDriverVersion);
    }

    const milestone = getMilestone(edgeVersion);

    if (Number(milestone) < MIN_EDGEDRIVER_VERSION) {
        const lines: string[] = [];

        lines.push(`Failed to install EdgeDriver for Edge@${milestone}: version is too old.`);
        lines.push(
            `\nTestplane's automatic EdgeDriver downloader only supports Edge versions >= ${MIN_EDGEDRIVER_VERSION}.`,
            `The requested version '${milestone}' is below this threshold.`,
        );

        lines.push(
            "\nWhat you can do:",
            `- Use Edge version ${MIN_EDGEDRIVER_VERSION} or higher`,
            "- Download EdgeDriver manually from https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/ and configure 'webdriverBinaryPath' in your config",
        );

        throw new Error(lines.join("\n"));
    }

    const driverVersion = await getLatestMajorEdgeDriverVersion(milestone);

    const installFn = (): Promise<string> => downloadEdgeDriver(driverVersion, getEdgeDriverDir(driverVersion));

    return registry.installBinary(DriverName.EDGEDRIVER, platform, driverVersion, installFn);
};
