import { memoize } from "lodash";
import path from "node:path";
import { HashProvider } from "./hash-provider";
import { getSelectivityHashesPath, readHashFileContents, shallowSortObject } from "./utils";
import { writeJsonWithCompression } from "./json-utils";
import type { NormalizedDependencies, SelectivityCompressionType } from "./types";

export class HashWriter {
    private readonly _hashProvider = new HashProvider();
    // "Promise<string>" - file/module hash, "Promise<Error>" - calculating hash error
    private readonly _stagedFileHashes = new Map<string, Promise<string | Error>>();
    private readonly _stagedModuleHashes = new Map<string, Promise<string | Error>>();
    private readonly _stagedPatternHashes = new Map<string, Promise<string | Error>>();
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

    addPatternDependencyHash(dependencyPattern: string): void {
        return this._addPatternDependency(dependencyPattern);
    }

    addTestDependencyHashes(dependencies: NormalizedDependencies): void {
        dependencies.css?.forEach(dependency => this._addFileDependency(dependency));
        dependencies.js?.forEach(dependency => this._addFileDependency(dependency));
        dependencies.png?.forEach(dependency => this._addFileDependency(dependency));
        dependencies.modules?.forEach(dependency => this._addModuleDependency(dependency));
    }

    async save(): Promise<void> {
        const hasStaged = Boolean(
            this._stagedFileHashes.size || this._stagedModuleHashes.size || this._stagedPatternHashes.size,
        );

        if (!hasStaged) {
            return;
        }

        const writeTo = async (
            src: Map<string, Promise<string | Error>>,
            dest: Record<string, string>,
        ): Promise<void> => {
            const keys = Array.from(src.keys());

            for (const key of keys) {
                const hash = await src.get(key);

                if (hash instanceof Error) {
                    throw hash;
                }

                dest[key] = hash as string;
            }

            shallowSortObject(dest);
        };

        const fileContents = await readHashFileContents(this._selectivityHashesPath, this._compresion);

        await writeTo(this._stagedFileHashes, fileContents.files);
        await writeTo(this._stagedModuleHashes, fileContents.modules);
        await writeTo(this._stagedPatternHashes, fileContents.patterns);

        await writeJsonWithCompression(this._selectivityHashesPath, fileContents, this._compresion);
    }
}

export const getHashWriter = memoize(
    (testDependenciesPath: string, compression: SelectivityCompressionType): HashWriter => {
        return new HashWriter(testDependenciesPath, compression);
    },
    (testDependenciesPath, compression) => `${testDependenciesPath}#${compression}`,
);
