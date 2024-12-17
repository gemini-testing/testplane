import execa from "execa";
import { getCliArgs } from "../utils";
import { throwIfFailed } from "./utils";
import { ensureUnixBinaryExists } from "../..";

const APT_FILE_BINARY_NAME = "apt-file";

/**
 * @summary search in which package a file is included
 * @returns name of the library, which can be downloaded via apt
 * @link https://manpages.org/apt-file
 */
export const aptFileSearch = async (fileToSearch: string): Promise<string> => {
    await ensureUnixBinaryExists(APT_FILE_BINARY_NAME);

    const args = getCliArgs({ "package-only": true });

    const result = await execa(APT_FILE_BINARY_NAME, ["search", fileToSearch, ...args]);

    throwIfFailed(result);

    return result.stdout;
};
