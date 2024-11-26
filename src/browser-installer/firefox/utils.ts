const firefoxChannels = ["stable", "nightly"];

export const normalizeFirefoxVersion = (version: string): string => {
    return version.includes(".") ? version : `${version}.0`;
};

export const getFirefoxBuildId = (version: string): string => {
    const normalizedVersion = normalizeFirefoxVersion(version);

    return firefoxChannels.some(channel => normalizedVersion.startsWith(`${channel}_`))
        ? version
        : `stable_${normalizedVersion}`;
};
