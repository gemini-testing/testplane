import { performance } from "perf_hooks";
import makeDebug from "debug";

export const debugDocker = makeDebug("testplane:docker");

/** Log before awaiting so a stalled operation is visible, too. */
export async function timeDockerOperation<T>(
    scope: string | undefined,
    operation: string,
    action: () => T | Promise<T>,
): Promise<T> {
    if (!scope || !debugDocker.enabled) return action();
    const started = performance.now();
    const prefix = `[Docker timing][${scope}] ${operation}`;
    debugDocker(`${prefix}: started`);
    try {
        const result = await action();
        debugDocker(`${prefix}: done in ${((performance.now() - started) / 1000).toFixed(3)}s`);
        return result;
    } catch (error) {
        debugDocker(`${prefix}: failed after ${((performance.now() - started) / 1000).toFixed(3)}s`);
        throw error;
    }
}
