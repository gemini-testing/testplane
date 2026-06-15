import makeDebug from "debug";

export const isVerboseScreenshotsDebugEnabled = (): boolean => Boolean(process.env.TESTPLANE_DEBUG_SCREENSHOTS);

export function makeVerboseScreenshotsDebug(namespace: string): ReturnType<typeof makeDebug> {
    const debug = makeDebug(namespace);
    const verboseDebug = ((...args: Parameters<typeof debug>) => {
        if (isVerboseScreenshotsDebugEnabled()) {
            debug(...args);
        }
    }) as ReturnType<typeof makeDebug>;

    Object.assign(verboseDebug, debug);
    Object.defineProperty(verboseDebug, "enabled", {
        get: () => isVerboseScreenshotsDebugEnabled() && debug.enabled,
        configurable: true,
    });

    return verboseDebug;
}
