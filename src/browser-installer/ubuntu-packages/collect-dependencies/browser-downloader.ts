import path from "path";
import fs from "fs";
import _ from "lodash";
import { installBrowser } from "../..";
import { getRegistryPath } from "../../utils";
import type { RegistryFileContents } from "../../registry";
import type { BrowserWithVersion } from "./utils";

const getRegistryBinaryPaths = (registry: RegistryFileContents): string[] => {
    const versionToPathMap = Object.values(registry.binaries);
    const binaryPaths = _.flatMap(versionToPathMap, Object.values);
    const registryPath = getRegistryPath();

    return binaryPaths.map(relativePath => path.resolve(registryPath, relativePath));
};

/** @returns array of binary absolute paths */
export const downloadBrowserVersions = async (browsers: BrowserWithVersion[]): Promise<string[]> => {
    if (!browsers.length) {
        return [];
    }

    const registryPath = getRegistryPath();

    const installBinaries = ({ browserName, browserVersion }: BrowserWithVersion): Promise<string | null> =>
        installBrowser(browserName, browserVersion, {
            shouldInstallWebDriver: true,
            shouldInstallUbuntuPackages: false,
        });

    await Promise.all(browsers.map(installBinaries));

    const registryJson = await fs.promises.readFile(registryPath, { encoding: "utf8" });
    const registry = JSON.parse(registryJson);

    return getRegistryBinaryPaths(registry);
};
