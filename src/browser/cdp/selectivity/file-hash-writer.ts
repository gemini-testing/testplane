import { memoize } from "lodash";
import path from "node:path";
import { FileHashProvider } from "./file-hash-provider";
import { shallowSortObject } from "./utils";
import type { NormalizedDependencies, SelectivityCompressionType } from "./types";
import { readJsonWithCompression, writeJsonWithCompression } from "./json-utils";

export class FileHashWriter {
    private readonly _fileHashProvider = new FileHashProvider();
    // "null" - successfully writed, "Promise<string>" - file/module hash, "Promise<Error>" - calculating hash error
    private readonly _stagedFileHashes = new Map<string, null | Promise<string | Error>>();
    private readonly _stagedModuleHashes = new Map<string, null | Promise<string | Error>>();
    private readonly _selectivityHashesPath: string;
    private readonly _compresion: SelectivityCompressionType;
    private _hashFileContents: Promise<{ files: Record<string, string>; modules: Record<string, string> }> | null =
        null;

    constructor(selectivityRootPath: string, compression: SelectivityCompressionType) {
        this._selectivityHashesPath = path.join(selectivityRootPath, "hashes.json");
        this._compresion = compression;
    }

    private _addFileDependency(filePath: string): void {
        if (this._stagedFileHashes.has(filePath)) {
            return;
        }

        const value = this._fileHashProvider.calculateFor(filePath).catch(err => err);

        this._stagedFileHashes.set(filePath, value);
    }
    private _addModuleDependency(modulePath: string): void {
        if (this._stagedModuleHashes.has(modulePath)) {
            return;
        }

        const filePath = path.join(modulePath, "package.json");
        const value = this._fileHashProvider.calculateFor(filePath).catch(err => err);

        this._stagedModuleHashes.set(modulePath, value);
    }

    private _ensureInited(): Promise<{ files: Record<string, string>; modules: Record<string, string> }> {
        if (this._hashFileContents) {
            return this._hashFileContents;
        }

        return (this._hashFileContents = readJsonWithCompression(this._selectivityHashesPath, this._compresion, {
            defaultValue: { files: {}, modules: {} },
        })
            .catch(() => ({ files: {}, modules: {} }))
            .then(res => {
                res.files ||= {};
                res.modules ||= {};

                return res;
            }));
    }

    add(dependencies: NormalizedDependencies): void {
        this._ensureInited();

        dependencies.css.forEach(dependency => this._addFileDependency(dependency));
        dependencies.js.forEach(dependency => this._addFileDependency(dependency));
        dependencies.modules.forEach(dependency => this._addModuleDependency(dependency));
    }

    async commit(): Promise<void> {
        const wasInited = Boolean(this._hashFileContents);
        const hasStaged = Boolean(this._stagedFileHashes.size || this._stagedModuleHashes.size);

        if (!wasInited || !hasStaged) {
            return;
        }

        const stagedModuleNames = Array.from(this._stagedModuleHashes.keys());
        const stagedFileNames = Array.from(this._stagedFileHashes.keys());

        const existingHashesContent = await this._ensureInited();

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

        const [updatedModules, updatedFiles] = await Promise.all([
            filterMatchingHashes(stagedModuleNames, this._stagedModuleHashes, existingHashesContent.modules),
            filterMatchingHashes(stagedFileNames, this._stagedFileHashes, existingHashesContent.files),
        ]);

        if (!updatedFiles.length && !updatedModules.length) {
            return;
        }

        await Promise.all([
            writeTo(updatedModules, this._stagedModuleHashes, existingHashesContent.modules),
            writeTo(updatedFiles, this._stagedFileHashes, existingHashesContent.files),
        ]);

        await writeJsonWithCompression(this._selectivityHashesPath, existingHashesContent, this._compresion);

        markAsCommited(updatedModules, this._stagedModuleHashes);
        markAsCommited(updatedFiles, this._stagedFileHashes);
    }
}

export const getFileHashWriter = memoize(
    (selectivityRootPath: string, compression: SelectivityCompressionType): FileHashWriter => {
        return new FileHashWriter(selectivityRootPath, compression);
    },
);
