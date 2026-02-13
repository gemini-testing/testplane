import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";

const calculateFileMd5Hash = (filePath: string): Promise<string> =>
    new Promise((resolve, reject) => {
        const hash = crypto.createHash("md5");
        const fileReadStream = fs.createReadStream(filePath);

        fileReadStream.on("data", chunk => hash.update(chunk));
        fileReadStream.on("end", () => resolve(hash.digest("hex")));
        fileReadStream.on("error", cause =>
            reject(new Error(`Selectivity: Couldn't calculate hash for ${filePath}`, { cause })),
        );
    });

export class HashProvider {
    private static readonly _fileHashStore: Map<string, Promise<string>> = new Map();
    private static readonly _patternHashStore: Map<string, Promise<string>> = new Map();

    async calculateForFile(filePath: string): Promise<string> {
        const cachedHash = HashProvider._fileHashStore.get(filePath);

        if (cachedHash) {
            return cachedHash;
        }

        const hashPromise = calculateFileMd5Hash(filePath);

        HashProvider._fileHashStore.set(filePath, hashPromise);

        return hashPromise;
    }

    async calculateForPattern(pattern: string): Promise<string> {
        const cachedHash = HashProvider._patternHashStore.get(pattern);

        if (cachedHash) {
            return cachedHash;
        }

        const calculatePatternHashPromise = (async (): Promise<string> => {
            const globExtra = await import("../../../bundle/glob-extra");

            const cwd = process.cwd();
            const files = await globExtra.expandPaths(pattern, { root: cwd });

            if (!files.length) {
                throw new Error(`Selectivity: Couldn't find files by disableSelectivityPattern "${pattern}"`);
            }

            const filesSorted = files.sort();
            const hash = crypto.createHash("md5");

            let promiseQue = Promise.resolve();

            for (const filePath of filesSorted) {
                const fileHashPromise = calculateFileMd5Hash(filePath);
                const cwdRelativePath = path.relative(cwd, filePath);
                const posixRelativePath =
                    path.sep === path.posix.sep
                        ? cwdRelativePath
                        : cwdRelativePath.replaceAll(path.sep, path.posix.sep);

                promiseQue = promiseQue.then(() =>
                    fileHashPromise.then(fileHash => {
                        hash.update(`/${posixRelativePath}/${fileHash}`);
                    }),
                );
            }

            return promiseQue.then(() => hash.digest("hex"));
        })();

        HashProvider._patternHashStore.set(pattern, calculatePatternHashPromise);

        return calculatePatternHashPromise;
    }
}
