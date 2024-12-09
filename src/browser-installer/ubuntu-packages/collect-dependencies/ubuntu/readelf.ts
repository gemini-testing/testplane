import execa from "execa";
import { getCliArgs } from "../utils";
import { throwIfFailed } from "./utils";
import { ensureUnixBinaryExists } from "../..";

const BINARY_NAME = "readelf";
/**
 * @summary get information about ELF files
 * @link https://manpages.org/readelf
 */
export const readElf = async (filePath: string, opts?: { dynamic?: boolean }): Promise<string> => {
    await ensureUnixBinaryExists(BINARY_NAME);

    const args = getCliArgs({ ...opts, wide: true });

    const result = await execa(BINARY_NAME, [filePath, ...args]);

    throwIfFailed(result);

    return result.stdout;
};
