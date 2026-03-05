import pLimit from "p-limit";
import fs from "fs-extra";
import path from "path";
import * as logger from "../../../../utils/logger";
import { getSelectivityTestsPath, shallowSortObject } from "../utils";
import { NormalizedDependencies, SelectivityCompressionType, TestDependenciesFileContents } from "../types";
import {
    getExistingJsonPathWithCompression,
    readJsonWithCompression,
    stripCompressionSuffix,
    writeJsonWithCompression,
} from "../json-utils";

const getUniqTestFiles = async (srcTestPaths: string[]): Promise<[Set<string>, Set<string>[]]> => {
    const summaryResult = new Set<string>();
    const testPathResults = srcTestPaths.map(() => new Set<string>());

    await Promise.all(
        srcTestPaths.map(async (srcTestPath, idx) => {
            if (!fs.existsSync(srcTestPath)) {
                logger.warn(`Skipping "${srcTestPath}" as it does not exist`);
            }

            const files = await fs.readdir(srcTestPath);

            files.forEach(file => {
                const baseFilePath = stripCompressionSuffix(file);

                summaryResult.add(baseFilePath);
                testPathResults[idx].add(baseFilePath);
            });
        }),
    );

    return [summaryResult, testPathResults];
};

const getFullTestPath = (sourceBasePath: string, preferredCompression: SelectivityCompressionType): string => {
    const sourcePath = getExistingJsonPathWithCompression(sourceBasePath, preferredCompression).jsonPath;

    if (!sourcePath) {
        throw new Error(
            [
                `Can't merge reports: no suitable source file was found by "${sourceBasePath}" base`,
                `It can happen if it was compressed with unsupported compression type, or if the file was removed during command run`,
                "If selectivity dump was created with node.js v22+, ensure you are currently is using it too",
            ].join("\n"),
        );
    }

    return sourcePath;
};

const mergeJsonTestContents = (
    testContents: Record<string, Record<string, NormalizedDependencies>>[],
): TestDependenciesFileContents => {
    const result: TestDependenciesFileContents = {};

    for (const testContent of testContents) {
        for (const browserId in testContent) {
            result[browserId] ||= {};

            for (const dependencyScope in testContent[browserId]) {
                result[browserId][dependencyScope] ||= {
                    css: [],
                    js: [],
                    modules: [],
                };

                for (const dependencyType in testContent[browserId][dependencyScope]) {
                    const depType = dependencyType as keyof NormalizedDependencies;
                    for (const dependency of testContent[browserId][dependencyScope][depType]) {
                        result[browserId][dependencyScope][depType].push(dependency);
                    }
                }
            }
        }
    }

    shallowSortObject(result);

    for (const browserId in result) {
        shallowSortObject(result[browserId]);

        for (const dependencyScope in result[browserId]) {
            for (const dependencyType in result[browserId][dependencyScope]) {
                const depType = dependencyType as keyof NormalizedDependencies;
                const depSet = new Set(result[browserId][dependencyScope][depType]);

                result[browserId][dependencyScope][depType] = Array.from(depSet).sort((a, b) => a.localeCompare(b));
            }
        }
    }

    return result;
};

export const mergeTests = async (
    destPath: string,
    selectivitySrcAbsolutePaths: string[],
    preferredCompression: SelectivityCompressionType,
): Promise<void> => {
    const selectivityTestsDestPath = getSelectivityTestsPath(destPath);
    const srcTestPaths = selectivitySrcAbsolutePaths.map(getSelectivityTestsPath);
    const [allSrcTests, srcTests] = await getUniqTestFiles(srcTestPaths);

    const limited = pLimit(32);
    const fsPromises: Promise<void>[] = [];

    await fs.ensureDir(selectivityTestsDestPath);

    allSrcTests.forEach(fileBase => {
        const fileProviders = srcTestPaths.filter((_, idx) => srcTests[idx].has(fileBase));

        if (fileProviders.length === 1) {
            const sourceBasePath = path.join(fileProviders[0], fileBase);
            const sourcePath = getFullTestPath(sourceBasePath, preferredCompression);
            const destinationPath = path.join(selectivityTestsDestPath, path.basename(sourcePath));

            fsPromises.push(limited(() => fs.copyFile(sourcePath, destinationPath)));
        } else {
            fsPromises.push(
                (async (): Promise<void> => {
                    const testContents = await Promise.all(
                        fileProviders.map(providerPath => {
                            const sourceBasePath = path.join(providerPath, fileBase);
                            return limited(() =>
                                readJsonWithCompression<TestDependenciesFileContents>(
                                    sourceBasePath,
                                    preferredCompression,
                                ).catch(cause => {
                                    throw new Error(`Couldn't read "${sourceBasePath}" with compression`, { cause });
                                }),
                            );
                        }),
                    );

                    const mergedResult = mergeJsonTestContents(testContents);
                    const destinationBasePath = path.join(selectivityTestsDestPath, fileBase);

                    return limited(() =>
                        writeJsonWithCompression(destinationBasePath, mergedResult, preferredCompression),
                    );
                })(),
            );
        }
    });

    await Promise.all(fsPromises);
};
