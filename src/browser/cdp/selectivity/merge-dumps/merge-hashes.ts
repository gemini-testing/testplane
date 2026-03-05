import { getSelectivityHashesPath, readHashFileContents } from "../utils";
import { HashFileContents, SelectivityCompressionType } from "../types";
import { writeJsonWithCompression } from "../json-utils";

export const mergeHashes = async (
    destPath: string,
    selectivitySrcAbsolutePaths: string[],
    preferredCompression: SelectivityCompressionType,
): Promise<void> => {
    const selectivityHashesDestPath = getSelectivityHashesPath(destPath);
    const sourceHashes = await Promise.all(
        selectivitySrcAbsolutePaths.map(sourcePath => {
            const selectivityHashesPath = getSelectivityHashesPath(sourcePath);

            return readHashFileContents(selectivityHashesPath, preferredCompression);
        }),
    );

    const result: HashFileContents = {
        files: {},
        modules: {},
        patterns: {},
    };

    const mergeFor = (source: HashFileContents, hashType: keyof HashFileContents): void => {
        const destination = result[hashType];
        for (const key in source[hashType]) {
            if (!destination[key]) {
                destination[key] = source[hashType][key];
            } else if (destination[key] !== source[hashType][key]) {
                throw new Error(
                    [
                        `Hashes for "${hashType}" "${key}" are not equal in different chunks`,
                        "This could happen if selectivity dumps were generated on different file states",
                    ].join("\n"),
                );
            }
        }
    };

    for (const sourceHash of sourceHashes) {
        mergeFor(sourceHash, "files");
        mergeFor(sourceHash, "modules");
        mergeFor(sourceHash, "patterns");
    }

    await writeJsonWithCompression(selectivityHashesDestPath, result, preferredCompression);
};
