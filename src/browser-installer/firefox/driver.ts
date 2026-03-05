import { download as downloadGeckoDriver } from "geckodriver";
import { GECKODRIVER_CARGO_TOML } from "../constants";
import registry from "../registry";
import { DriverName, browserInstallerDebug, getBrowserPlatform, getGeckoDriverDir, retryFetch } from "../utils";

const getLatestGeckoDriverVersion = async (): Promise<string> => {
    const cargoVersionsToml = await retryFetch(GECKODRIVER_CARGO_TOML).then(res => res.text());
    const version = cargoVersionsToml.split("\n").find(line => line.startsWith("version = "));

    if (!version) {
        const lines: string[] = [];

        lines.push("Failed to resolve the latest GeckoDriver version.");
        lines.push(
            "\nTestplane fetched the GeckoDriver Cargo.toml from:",
            `  ${GECKODRIVER_CARGO_TOML}`,
            "but could not find a version string in the response.",
        );

        lines.push(
            "\nPossible reasons:",
            "- The network request succeeded but the file format changed unexpectedly",
            "- The geckodriver repository structure has been updated",
        );

        lines.push(
            "\nWhat you can do:",
            "- Check your internet connection and try again",
            "- If the problem persists, open an issue at https://github.com/gemini-testing/testplane",
        );

        throw new Error(lines.join("\n"));
    }

    const latestGeckoVersion = version.split(" = ").pop()!.slice(1, -1);

    browserInstallerDebug(`resolved latest geckodriver version: ${latestGeckoVersion}`);

    return latestGeckoVersion;
};

export const installLatestGeckoDriver = async (firefoxVersion: string, { force = false } = {}): Promise<string> => {
    const platform = getBrowserPlatform();
    const existingLocallyDriverVersion = registry.getMatchedDriverVersion(
        DriverName.GECKODRIVER,
        platform,
        firefoxVersion,
    );

    if (existingLocallyDriverVersion && !force) {
        browserInstallerDebug(
            `A locally installed geckodriver for firefox@${firefoxVersion} browser was found. Skipping the installation`,
        );

        return registry.getBinaryPath(DriverName.GECKODRIVER, platform, existingLocallyDriverVersion);
    }

    const latestVersion = await getLatestGeckoDriverVersion();

    const installFn = (): Promise<string> => downloadGeckoDriver(latestVersion, getGeckoDriverDir(latestVersion));

    return registry.installBinary(DriverName.GECKODRIVER, platform, latestVersion, installFn);
};
