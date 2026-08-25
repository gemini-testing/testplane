const MAX_EXIT_CODE = 255;
const MIN_SIGNAL_EXIT_CODE = 129;

const normalizeExitCode = (exitCode: NodeJS.Process["exitCode"]): number | undefined => {
    const numericExitCode =
        typeof exitCode === "string" && /^(?:0|[1-9]\d*)$/.test(exitCode) ? Number(exitCode) : exitCode;

    return typeof numericExitCode === "number" &&
        Number.isInteger(numericExitCode) &&
        numericExitCode >= 0 &&
        numericExitCode <= MAX_EXIT_CODE
        ? numericExitCode
        : undefined;
};

export const resolveExitCode = (fallback: number): number => {
    const safeFallback = normalizeExitCode(fallback) ?? 1;
    const rawPendingExitCode = process.exitCode;
    const pendingExitCode = normalizeExitCode(rawPendingExitCode);

    if (rawPendingExitCode === null || rawPendingExitCode === undefined || pendingExitCode === 0) {
        return safeFallback;
    }

    if (pendingExitCode === undefined) {
        return safeFallback || 1;
    }

    return pendingExitCode >= MIN_SIGNAL_EXIT_CODE || safeFallback === 0 ? pendingExitCode : safeFallback;
};
