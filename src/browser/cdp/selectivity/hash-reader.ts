import { memoize } from "lodash";
import path from "node:path";
import { HashProvider } from "./hash-provider";
import { getSelectivityHashesPath, readHashFileContents } from "./utils";
import { debugSelectivity } from "./debug";
import type { HashFileContents, NormalizedDependencies, SelectivityCompressionType } from "./types";

export class HashReader {
    private readonly _hashProvider = new HashProvider();
    private readonly _selectivityHashesPath: string;
    private readonly _compresion: SelectivityCompressionType;
    private _hashFileContents: Promise<HashFileContents> | null = null;

    constructor(selectivityRootPath: string, compression: SelectivityCompressionType) {
        this._selectivityHashesPath = getSelectivityHashesPath(selectivityRootPath);
        this._compresion = compression;
    }

    private _getHashFileContents(): Promise<HashFileContents> {
        if (this._hashFileContents) {
            return this._hashFileContents;
        }

        return (this._hashFileContents = readHashFileContents(this._selectivityHashesPath, this._compresion));
    }

    private _readHashForFile(filePath: string): Promise<string> {
        return this._getHashFileContents().then(hashFileContents => hashFileContents.files[filePath]);
    }

    private _readHashForModule(moduleName: string): Promise<string> {
        return this._getHashFileContents().then(hashFileContents => hashFileContents.modules[moduleName]);
    }

    private _readHashForPattern(pattern: string): Promise<string> {
        return this._getHashFileContents().then(hashFileContents => hashFileContents.patterns[pattern]);
    }

    async patternHasChanged(pattern: string): Promise<boolean> {
        const [cachedPatternHash, calculatedPatternHash] = await Promise.all([
            this._readHashForPattern(pattern),
            this._hashProvider.calculateForPattern(pattern),
        ]);

        return cachedPatternHash !== calculatedPatternHash;
    }

    /** @returns changed deps or null, if nothing changed */
    async getTestChangedDeps(testDeps: NormalizedDependencies): Promise<NormalizedDependencies | null> {
        const depFileTypes: Array<keyof NormalizedDependencies> = ["css", "js", "modules"] as const;
        const result: NormalizedDependencies = { css: [], js: [], modules: [] };

        let hasAnythingChanged = false;

        const checkForDepFileType = async (depFileType: keyof NormalizedDependencies): Promise<void> => {
            await Promise.all(
                testDeps[depFileType].map(async filePath => {
                    const adjustedFilePath = depFileType === "modules" ? path.join(filePath, "package.json") : filePath;
                    const [cachedFileHash, calculatedFileHash] = await Promise.all([
                        depFileType === "modules" ? this._readHashForModule(filePath) : this._readHashForFile(filePath),
                        this._hashProvider.calculateForFile(adjustedFilePath).catch((err: Error) => err),
                    ]);

                    if (calculatedFileHash instanceof Error) {
                        debugSelectivity(
                            `Couldn't calculate hash for ${adjustedFilePath}: ${calculatedFileHash.message}`,
                        );
                    }

                    if (cachedFileHash !== calculatedFileHash) {
                        hasAnythingChanged = true;
                        result[depFileType].push(filePath);
                    }
                }),
            );
        };

        await Promise.all(depFileTypes.map(depFileType => checkForDepFileType(depFileType)));

        return hasAnythingChanged ? result : null;
    }
}

export const getHashReader = memoize(
    (selectivityRootPath: string, compression: SelectivityCompressionType): HashReader => {
        return new HashReader(selectivityRootPath, compression);
    },
    (selectivityRootPath, compression) => `${selectivityRootPath}#${compression}`,
);
