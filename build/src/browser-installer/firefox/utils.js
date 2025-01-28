"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFirefoxBuildId = exports.normalizeFirefoxVersion = void 0;
const firefoxChannels = ["stable", "nightly"];
const normalizeFirefoxVersion = (version) => {
    return version.includes(".") ? version : `${version}.0`;
};
exports.normalizeFirefoxVersion = normalizeFirefoxVersion;
const getFirefoxBuildId = (version) => {
    const normalizedVersion = (0, exports.normalizeFirefoxVersion)(version);
    return firefoxChannels.some(channel => normalizedVersion.startsWith(`${channel}_`))
        ? version
        : `stable_${normalizedVersion}`;
};
exports.getFirefoxBuildId = getFirefoxBuildId;
//# sourceMappingURL=utils.js.map