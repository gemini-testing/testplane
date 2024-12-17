import { download as downloadGeckoDriver } from "geckodriver";
import { GECKODRIVER_CARGO_TOML } from "../constants";
import registry from "../registry";
import { Driver, browserInstallerDebug, getBrowserPlatform, getGeckoDriverDir, retryFetch } from "../utils";

const getLatestGeckoDriverVersion = async (): Promise<string> => {
    const cargoVersionsToml = await retryFetch(GECKODRIVER_CARGO_TOML).then(res => res.text());
    const version = cargoVersionsToml.split("\n").find(line => line.startsWith("version = "));

    if (!version) {
        throw new Error("Couldn't resolve latest geckodriver version while downloading geckodriver");
    }

    const latestGeckoVersion = version.split(" = ").pop()!.slice(1, -1);

    browserInstallerDebug(`resolved latest geckodriver version: ${latestGeckoVersion}`);

    return latestGeckoVersion;
};

export const installLatestGeckoDriver = async (firefoxVersion: string, { force = false } = {}): Promise<string> => {
    const platform = getBrowserPlatform();
    const existingLocallyDriverVersion = registry.getMatchedDriverVersion(Driver.GECKODRIVER, platform, firefoxVersion);

    if (existingLocallyDriverVersion && !force) {
        browserInstallerDebug(
            `A locally installed geckodriver for firefox@${firefoxVersion} browser was found. Skipping the installation`,
        );

        return registry.getBinaryPath(Driver.GECKODRIVER, platform, existingLocallyDriverVersion);
    }

    const latestVersion = await getLatestGeckoDriverVersion();

    const installFn = (): Promise<string> => downloadGeckoDriver(latestVersion, getGeckoDriverDir(latestVersion));

    return registry.installBinary(Driver.GECKODRIVER, platform, latestVersion, installFn);
};
