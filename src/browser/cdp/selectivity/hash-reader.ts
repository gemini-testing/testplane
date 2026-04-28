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
    private _fileStateCache = new Map<string, boolean>();

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

    async patternHasChanged(pattern: string): Promise<boolean> {
        const fileContents = await this._getHashFileContents();
        const cachedPatternHash = fileContents.patterns[pattern];
        const calculatedPatternHash = await this._hashProvider.calculateForPattern(pattern);

        return cachedPatternHash !== calculatedPatternHash;
    }

    /** @returns changed deps or null, if nothing changed */
    async getTestChangedDeps(testDeps: NormalizedDependencies): Promise<NormalizedDependencies | null> {
        const depFileTypes: Array<keyof NormalizedDependencies> = ["css", "js", "modules", "png"] as const;
        const fileContents = await this._getHashFileContents();

        let result: NormalizedDependencies | null = null;

        const checkForDepFileType = async (depFileType: keyof NormalizedDependencies): Promise<void> => {
            // Old selectivity dependency files did not have "png" property
            if (!testDeps[depFileType]) {
                return;
            }

            for (const filePath of testDeps[depFileType]) {
                const isChanged = this._fileStateCache.get(filePath);

                if (isChanged === false) {
                    continue;
                } else if (isChanged === true) {
                    result ||= { css: [], js: [], modules: [], png: [] };
                    result[depFileType].push(filePath);
                    continue;
                }

                const adjustedFilePath = depFileType === "modules" ? path.join(filePath, "package.json") : filePath;
                const cachedFileHash =
                    depFileType === "modules" ? fileContents.modules[filePath] : fileContents.files[filePath];

                const calculatedFileHash = await this._hashProvider
                    .calculateForFile(adjustedFilePath)
                    .catch((err: Error) => err);

                if (calculatedFileHash instanceof Error) {
                    debugSelectivity(`${calculatedFileHash.message}: ${calculatedFileHash.cause}`);
                }

                if (cachedFileHash !== calculatedFileHash) {
                    result ||= { css: [], js: [], modules: [], png: [] };
                    result[depFileType].push(filePath);
                    this._fileStateCache.set(filePath, true);
                } else {
                    this._fileStateCache.set(filePath, false);
                }
            }
        };

        for (const depFileType of depFileTypes) {
            await checkForDepFileType(depFileType);
        }

        return result;
    }

    clearCache(): void {
        this._fileStateCache.clear();
    }
}

export const getHashReader = memoize(
    (selectivityRootPath: string, compression: SelectivityCompressionType): HashReader => {
        return new HashReader(selectivityRootPath, compression);
    },
    (selectivityRootPath, compression) => `${selectivityRootPath}#${compression}`,
);
