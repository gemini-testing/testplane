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
        throw new Error(`Couldn't resolve latest edgedriver version for ${milestone}`);
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
        throw new Error(`Automatic driver downloader is not available for Edge versions < ${MIN_EDGEDRIVER_VERSION}`);
    }

    const driverVersion = await getLatestMajorEdgeDriverVersion(milestone);

    const installFn = (): Promise<string> => downloadEdgeDriver(driverVersion, getEdgeDriverDir(driverVersion));

    return registry.installBinary(DriverName.EDGEDRIVER, platform, driverVersion, installFn);
};
