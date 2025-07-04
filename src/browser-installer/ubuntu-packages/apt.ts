import _ from "lodash";
import os from "os";
import path from "path";
import fs from "fs-extra";
import { exec } from "child_process";
import { ensureUnixBinaryExists } from "./utils";
import { browserInstallerDebug, type DownloadProgressCallback } from "../utils";
import { MANDATORY_UBUNTU_PACKAGES_TO_BE_INSTALLED } from "../constants";

/** @link https://manpages.org/apt-cache/8 */
export const resolveTransitiveDependencies = async (directDependencies: string[]): Promise<string[]> => {
    await Promise.all(["apt-cache", "grep", "sort"].map(ensureUnixBinaryExists));

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

    const listDependencies = (dependencyName: string): Promise<string[]> =>
        new Promise<string[]>((resolve, reject) => {
            exec(`apt-cache depends ${aptDependsArgs} "${dependencyName}" | grep "^\\w" | sort -u`, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result.split(/\s+/).filter(Boolean));
                }
            });
        });

    const fullDependencies = await Promise.all(directDependencies.map(listDependencies));

    const rawDependencies = _.flatten(fullDependencies);

    return _.uniq(rawDependencies);
};

/** @link https://manpages.org/apt/8 */
const filterNotExistingDependencies = async (dependencies: string[]): Promise<string[]> => {
    if (!dependencies.length) {
        return [];
    }

    await ensureUnixBinaryExists("apt");

    const existingDependencies = await new Promise<string[]>((resolve, reject) => {
        exec(`apt list ${dependencies.join(" ")} --installed`, (err, result) => {
            if (err) {
                reject(err);
            } else {
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

    return _.difference(dependencies, existingDependencies);
};

/** @link https://manpages.org/apt-get/8 */
const downloadUbuntuPackages = async (dependencies: string[], targetDir: string): Promise<void> => {
    if (!dependencies.length) {
        return;
    }

    await ensureUnixBinaryExists("apt-get");

    return new Promise((resolve, reject) => {
        exec(`apt-get download ${dependencies.join(" ")}`, { cwd: targetDir }, err => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

/** @link https://manpages.org/dpkg */
const unpackUbuntuPackages = async (packagesDir: string, destination: string): Promise<void> => {
    await Promise.all([ensureUnixBinaryExists("dpkg"), fs.ensureDir(destination)]);

    return new Promise((resolve, reject) => {
        exec(`for pkg in *.deb; do dpkg -x $pkg ${destination}; done`, { cwd: packagesDir }, err => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

export const installUbuntuPackages = async (
    packages: string[],
    destination: string,
    { downloadProgressCallback }: { downloadProgressCallback: DownloadProgressCallback },
): Promise<void> => {
    if (!packages) {
        browserInstallerDebug(`There are no ubuntu packages to install`);

        return;
    }

    const dependenciesToDownload = await filterNotExistingDependencies(packages);

    downloadProgressCallback(70);

    const missingPkgs = MANDATORY_UBUNTU_PACKAGES_TO_BE_INSTALLED.filter(pkg => dependenciesToDownload.includes(pkg));

    if (missingPkgs.length) {
        throw new Error(
            [
                "Missing some packages, which needs to be installed manually",
                `Use \`apt-get install ${missingPkgs.join(" ")}\` to install them`,
                `Then run "testplane install-deps" again\n`,
            ].join("\n"),
        );
    }

    browserInstallerDebug(`There are ${dependenciesToDownload.length} deb packages to download`);

    if (!dependenciesToDownload.length) {
        return;
    }

    const tmpPackagesDir = await fs.mkdtemp(path.join(os.tmpdir(), "testplane-ubuntu-apt-packages"));

    await downloadUbuntuPackages(dependenciesToDownload, tmpPackagesDir);

    downloadProgressCallback(100);

    browserInstallerDebug(`Downloaded ${dependenciesToDownload.length} deb packages`);

    await unpackUbuntuPackages(tmpPackagesDir, destination);

    browserInstallerDebug(`Unpacked ${dependenciesToDownload.length} deb packages`);
};
