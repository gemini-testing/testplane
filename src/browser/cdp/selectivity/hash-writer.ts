import { memoize } from "lodash";
import path from "node:path";
import lockfile from "proper-lockfile";
import { HashProvider } from "./hash-provider";
import { getSelectivityHashesPath, readHashFileContents, shallowSortObject } from "./utils";
import { writeJsonWithCompression } from "./json-utils";
import type { NormalizedDependencies, SelectivityCompressionType } from "./types";

export class HashWriter {
    private readonly _hashProvider = new HashProvider();
    // "null" - successfully writed, "Promise<string>" - file/module hash, "Promise<Error>" - calculating hash error
    private readonly _stagedFileHashes = new Map<string, null | Promise<string | Error>>();
    private readonly _stagedModuleHashes = new Map<string, null | Promise<string | Error>>();
    private readonly _stagedPatternHashes = new Map<string, null | Promise<string | Error>>();
    private readonly _selectivityHashesPath: string;
    private readonly _compresion: SelectivityCompressionType;

    constructor(testDependenciesPath: string, compression: SelectivityCompressionType) {
        this._selectivityHashesPath = getSelectivityHashesPath(testDependenciesPath);
        this._compresion = compression;
    }

    private _addFileDependency(filePath: string): void {
        if (this._stagedFileHashes.has(filePath)) {
            return;
        }

        const value = this._hashProvider.calculateForFile(filePath).catch(err => err);

        this._stagedFileHashes.set(filePath, value);
    }

    private _addPatternDependency(pattern: string): void {
        if (this._stagedPatternHashes.has(pattern)) {
            return;
        }

        const value = this._hashProvider.calculateForPattern(pattern).catch(err => err);

        this._stagedPatternHashes.set(pattern, value);
    }

    private _addModuleDependency(modulePath: string): void {
        if (this._stagedModuleHashes.has(modulePath)) {
            return;
        }

        const filePath = path.join(modulePath, "package.json");
        const value = this._hashProvider.calculateForFile(filePath).catch(err => err);

        this._stagedModuleHashes.set(modulePath, value);
    }

    addPatternDependencyHash(dependencyPatterns: string): void {
        return this._addPatternDependency(dependencyPatterns);
    }

    addTestDependencyHashes(dependencies: NormalizedDependencies): void {
        dependencies.css.forEach(dependency => this._addFileDependency(dependency));
        dependencies.js.forEach(dependency => this._addFileDependency(dependency));
        dependencies.modules.forEach(dependency => this._addModuleDependency(dependency));
    }

    async commit(): Promise<void> {
        const hasStaged = Boolean(
            this._stagedFileHashes.size || this._stagedModuleHashes.size || this._stagedPatternHashes.size,
        );

        if (!hasStaged) {
            return;
        }

        const stagedModuleNames = Array.from(this._stagedModuleHashes.keys());
        const stagedFileNames = Array.from(this._stagedFileHashes.keys());
        const stagedPatternNames = Array.from(this._stagedPatternHashes.keys());

        const filterMatchingHashes = async (
            keys: string[],
            src: Map<string, null | Promise<string | Error>>,
            dest: Record<string, string>,
        ): Promise<string[]> => {
            const remainingKeys: string[] = [];

            for (const key of keys) {
                const oldValue = dest[key];
                const newValue = await src.get(key);

                if (newValue === null) {
                    continue;
                }

                if (newValue === oldValue) {
                    src.set(key, null);
                } else {
                    remainingKeys.push(key);
                }
            }

            return remainingKeys;
        };

        const writeTo = async (
            keys: string[],
            src: Map<string, null | Promise<string | Error>>,
            dest: Record<string, string>,
        ): Promise<void> => {
            let needsReSort = false;

            for (const key of keys) {
                const hash = await src.get(key);

                if (!hash) {
                    continue;
                }

                if (hash instanceof Error) {
                    throw hash;
                }

                needsReSort = needsReSort || !Object.hasOwn(dest, key);

                dest[key] = hash;
            }

            if (needsReSort) {
                shallowSortObject(dest);
            }
        };

        const markAsCommited = (keys: string[], src: Map<string, null | Promise<string | Error>>): void => {
            keys.forEach(key => src.set(key, null));
        };

        // Waiting for hashes to be calculated before locking file to reduce lock time
        await Promise.all([
            ...Object.values(this._stagedFileHashes),
            ...Object.values(this._stagedModuleHashes),
            ...Object.values(this._stagedPatternHashes),
        ]);

        const releaseLock = await lockfile.lock(this._selectivityHashesPath, {
            stale: 5000,
            update: 1000,
            retries: { minTimeout: 100, maxTimeout: 1000, retries: 15 },
            realpath: false,
        });

        try {
            const existingHashesContent = await readHashFileContents(this._selectivityHashesPath, this._compresion);

            const [updatedModules, updatedFiles, updatedPatterns] = await Promise.all([
                filterMatchingHashes(stagedModuleNames, this._stagedModuleHashes, existingHashesContent.modules),
                filterMatchingHashes(stagedFileNames, this._stagedFileHashes, existingHashesContent.files),
                filterMatchingHashes(stagedPatternNames, this._stagedPatternHashes, existingHashesContent.patterns),
            ]);

            if (!updatedFiles.length && !updatedModules.length && !updatedPatterns.length) {
                await releaseLock();
                return;
            }

            await Promise.all([
                writeTo(updatedModules, this._stagedModuleHashes, existingHashesContent.modules),
                writeTo(updatedFiles, this._stagedFileHashes, existingHashesContent.files),
                writeTo(updatedPatterns, this._stagedPatternHashes, existingHashesContent.patterns),
            ]);

            await writeJsonWithCompression(this._selectivityHashesPath, existingHashesContent, this._compresion);

            await releaseLock();

            markAsCommited(updatedModules, this._stagedModuleHashes);
            markAsCommited(updatedFiles, this._stagedFileHashes);
        } catch (err) {
            await releaseLock();

            throw err;
        }
    }
}

export const getHashWriter = memoize(
    (testDependenciesPath: string, compression: SelectivityCompressionType): HashWriter => {
        return new HashWriter(testDependenciesPath, compression);
    },
    (testDependenciesPath, compression) => `${testDependenciesPath}#${compression}`,
);
