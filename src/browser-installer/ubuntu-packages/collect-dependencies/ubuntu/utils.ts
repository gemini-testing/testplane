import type { ExecaReturnValue } from "execa";

export const throwIfFailed = (execaResult: ExecaReturnValue): void => {
    const { exitCode, failed, command, stderr } = execaResult;

    if (failed) {
        throw new Error(`Command "${command}" failed with exit code "${exitCode}". stderr:\n${stderr}`);
    }
};
