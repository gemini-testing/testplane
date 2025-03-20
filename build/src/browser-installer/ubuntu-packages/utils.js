"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUbuntuMilestone = exports.isUbuntu = exports.ensureUnixBinaryExists = void 0;
const lodash_1 = __importDefault(require("lodash"));
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const utils_1 = require("../utils");
const constants_1 = require("../constants");
/** @link https://manpages.org/os-release/5 */
const OS_RELEASE_PATH = "/etc/os-release";
/** @link https://manpages.org/which */
const ensureUnixBinaryExists = (binaryName) => new Promise((resolve, reject) => (0, child_process_1.exec)(`which "${binaryName}"`, err => {
    (0, utils_1.browserInstallerDebug)(`Checking binary "${binaryName}" is installed: ${!err}`);
    if (err) {
        reject(new Error(`Binary "${binaryName}" does not exist`));
    }
    else {
        resolve();
    }
}));
exports.ensureUnixBinaryExists = ensureUnixBinaryExists;
/** @link https://manpages.org/os-release/5 */
const osRelease = async () => {
    if (!fs_1.default.existsSync(OS_RELEASE_PATH)) {
        throw new Error(`"${OS_RELEASE_PATH}" is missing. Probably its not Linux`);
    }
    const fileContents = await fs_1.default.promises.readFile(OS_RELEASE_PATH, "utf8");
    const result = {};
    for (const line of fileContents.split("\n")) {
        if (!line.includes("=")) {
            continue;
        }
        const splitPosition = line.indexOf("=");
        const key = line.slice(0, splitPosition);
        const value = line.slice(splitPosition + 1);
        const valueIsWrappedWithQuotes = value.startsWith('"') && value.endsWith('"');
        result[key] = valueIsWrappedWithQuotes ? value.slice(1, -1) : value;
    }
    return result;
};
const osReleaseCached = lodash_1.default.once(osRelease);
const isUbuntu = async () => {
    return osReleaseCached()
        .then(release => release.ID === constants_1.LINUX_UBUNTU_RELEASE_ID)
        .catch(() => false);
};
exports.isUbuntu = isUbuntu;
const getUbuntuMilestone = async () => {
    const release = await osReleaseCached();
    if (!release.VERSION_ID) {
        throw new Error(`VERSION_ID is missing in ${OS_RELEASE_PATH}. Probably its not Ubuntu`);
    }
    return release.VERSION_ID.split(".")[0];
};
exports.getUbuntuMilestone = getUbuntuMilestone;
//# sourceMappingURL=utils.js.map