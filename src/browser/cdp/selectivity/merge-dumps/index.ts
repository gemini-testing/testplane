import fs from "fs-extra";
import path from "path";
import { mergeHashes } from "./merge-hashes";
import { SelectivityCompressionType } from "../types";
import { mergeTests } from "./merge-tests";

export const mergeSelectivityDumps = async (
    destPath: string,
    sourcePaths: string[],
    preferredCompression: SelectivityCompressionType,
): Promise<void> => {
    const destAbsolutePath = path.resolve(destPath);
    const srcAbsolutePaths = sourcePaths.map(sourcePath => path.resolve(sourcePath));

    await fs.ensureDir(destAbsolutePath);

    await fs.promises.access(destAbsolutePath, fs.constants.W_OK).catch(cause => {
        throw new Error(`Couldn't get write access to destination directory "${destAbsolutePath}"`, { cause });
    });

    await Promise.all(
        srcAbsolutePaths.map(srcAbsolutePath => {
            return fs.promises.access(srcAbsolutePath, fs.constants.R_OK).catch(cause => {
                throw new Error(`Couldn't get read access to source directory "${srcAbsolutePath}"`, { cause });
            });
        }),
    );

    await mergeHashes(destAbsolutePath, srcAbsolutePaths, preferredCompression);

    await mergeTests(destAbsolutePath, srcAbsolutePaths, preferredCompression);

    console.info(`Successfully merged selectivity dumps into "${destAbsolutePath}"`);
};
