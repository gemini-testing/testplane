"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.installUbuntuPackages = void 0;
const lodash_1 = __importDefault(require("lodash"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const child_process_1 = require("child_process");
const utils_1 = require("./utils");
const utils_2 = require("../utils");
const constants_1 = require("../constants");
/** @link https://manpages.org/apt-cache/8 */
const resolveTransitiveDependencies = async (directDependencies) => {
    await Promise.all(["apt-cache", "grep", "sort"].map(utils_1.ensureUnixBinaryExists));
    const aptDependsArgs = [
        "recurse",
        "no-recommends",
        "no-suggests",
        "no-conflicts",
        "no-breaks",
        "no-replaces",
        "no-enhances",
    ]
        .map(arg => `--${arg}`)
        .join(" ");
    const listDependencies = (dependencyName) => new Promise((resolve, reject) => {
        (0, child_process_1.exec)(`apt-cache depends ${aptDependsArgs} "${dependencyName}" | grep "^\\w" | sort -u`, (err, result) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(result.split(/\s+/).filter(Boolean));
            }
        });
    });
    const fullDependencies = await Promise.all(directDependencies.map(listDependencies));
    const rawDependencies = lodash_1.default.flatten(fullDependencies);
    return lodash_1.default.uniq(rawDependencies);
};
/** @link https://manpages.org/apt/8 */
const filterNotExistingDependencies = async (dependencies) => {
    if (!dependencies.length) {
        return [];
    }
    await (0, utils_1.ensureUnixBinaryExists)("apt");
    const existingDependencies = await new Promise((resolve, reject) => {
        (0, child_process_1.exec)(`apt list ${dependencies.join(" ")} --installed`, (err, result) => {
            if (err) {
                reject(err);
            }
            else {
                const lines = result.split("\n");
                const existingDependencies = lines
                    .map(line => {
                    const slashIndex = line.indexOf("/");
                    if (slashIndex === -1) {
                        return "";
                    }
                    return line.slice(0, slashIndex);
                })
                    .filter(Boolean);
                resolve(existingDependencies);
            }
        });
    });
    return lodash_1.default.difference(dependencies, existingDependencies);
};
/** @link https://manpages.org/apt-get/8 */
const downloadUbuntuPackages = async (dependencies, targetDir) => {
    if (!dependencies.length) {
        return;
    }
    await (0, utils_1.ensureUnixBinaryExists)("apt-get");
    return new Promise((resolve, reject) => {
        (0, child_process_1.exec)(`apt-get download ${dependencies.join(" ")}`, { cwd: targetDir }, err => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
};
/** @link https://manpages.org/dpkg */
const unpackUbuntuPackages = async (packagesDir, destination) => {
    await Promise.all([(0, utils_1.ensureUnixBinaryExists)("dpkg"), fs_extra_1.default.ensureDir(destination)]);
    return new Promise((resolve, reject) => {
        (0, child_process_1.exec)(`for pkg in *.deb; do dpkg -x $pkg ${destination}; done`, { cwd: packagesDir }, err => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
};
const installUbuntuPackages = async (packages, destination, { downloadProgressCallback }) => {
    if (!packages) {
        (0, utils_2.browserInstallerDebug)(`There are no ubuntu packages to install`);
        return;
    }
    const withRecursiveDependencies = await resolveTransitiveDependencies(packages);
    downloadProgressCallback(40);
    (0, utils_2.browserInstallerDebug)(`Resolved direct packages to ${withRecursiveDependencies.length} dependencies`);
    const dependenciesToDownload = await filterNotExistingDependencies(withRecursiveDependencies);
    downloadProgressCallback(70);
    const missingPkgs = constants_1.MANDATORY_UBUNTU_PACKAGES_TO_BE_INSTALLED.filter(pkg => dependenciesToDownload.includes(pkg));
    if (missingPkgs.length) {
        throw new Error([
            "Missing some packages, which needs to be installed manually",
            `Use \`apt-get install ${missingPkgs.join(" ")}\` to install them`,
            `Then run "testplane install-deps" again\n`,
        ].join("\n"));
    }
    (0, utils_2.browserInstallerDebug)(`There are ${dependenciesToDownload.length} deb packages to download`);
    if (!dependenciesToDownload.length) {
        return;
    }
    const tmpPackagesDir = await fs_extra_1.default.mkdtemp(path_1.default.join(os_1.default.tmpdir(), "testplane-ubuntu-apt-packages"));
    await downloadUbuntuPackages(dependenciesToDownload, tmpPackagesDir);
    downloadProgressCallback(100);
    (0, utils_2.browserInstallerDebug)(`Downloaded ${dependenciesToDownload.length} deb packages`);
    await unpackUbuntuPackages(tmpPackagesDir, destination);
    (0, utils_2.browserInstallerDebug)(`Unpacked ${dependenciesToDownload.length} deb packages`);
};
exports.installUbuntuPackages = installUbuntuPackages;
//# sourceMappingURL=apt.js.map