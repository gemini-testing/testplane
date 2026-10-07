import { performance } from "perf_hooks";
import { log } from "../utils/logger";

/** Log before awaiting so a stalled operation is visible, too. */
export async function timeDockerOperation<T>(
    scope: string | undefined,
    operation: string,
    action: () => T | Promise<T>,
): Promise<T> {
    if (!scope) return action();
    const started = performance.now();
    const prefix = `[Docker timing][${scope}] ${operation}`;
    log(`${prefix}: started`);
    try {
        const result = await action();
        log(`${prefix}: done in ${((performance.now() - started) / 1000).toFixed(3)}s`);
        return result;
    } catch (error) {
        log(`${prefix}: failed after ${((performance.now() - started) / 1000).toFixed(3)}s`);
        throw error;
    }
}
