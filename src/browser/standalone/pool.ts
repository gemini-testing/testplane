import { isEqual } from "lodash";
import { BasicPool } from "../../browser-pool/basic-pool";
import type { LocalBrowserBackendOptions } from "../../browser-backend/local";
import { AsyncEmitter, MasterEvents } from "../../events";
import signalHandler from "../../signal-handler";

interface SharedPool {
    pool: BasicPool;
    options: LocalBrowserBackendOptions;
    users: number;
    closing: Promise<void> | null;
}

let sharedPool: SharedPool | null = null;

export async function acquireStandalonePool(
    options: LocalBrowserBackendOptions,
): Promise<AsyncDisposable & { pool: BasicPool }> {
    while (sharedPool?.closing) await sharedPool.closing.catch(() => null);

    if (!sharedPool) {
        const exitListeners = new Set(signalHandler.listeners(MasterEvents.EXIT));
        const pool = BasicPool.create(options, new AsyncEmitter());
        // Standalone sessions are closed explicitly; detach the pool's automatic exit handler.
        for (const listener of signalHandler.listeners(MasterEvents.EXIT)) {
            if (!exitListeners.has(listener)) signalHandler.off(MasterEvents.EXIT, listener);
        }
        sharedPool = {
            pool,
            options,
            users: 0,
            closing: null,
        };
    }
    const shared = sharedPool;
    if (!isEqual(shared.options, options)) {
        throw new Error("Concurrent standalone browsers must use the same download mirrors and debug settings.");
    }
    // Count pending launches too, so closing another session cannot interrupt initialization.
    shared.users++;
    let released: Promise<void> | null = null;
    return {
        pool: shared.pool,
        [Symbol.asyncDispose](): Promise<void> {
            released ??= (async (): Promise<void> => {
                if (--shared.users === 0) {
                    shared.closing = shared.pool[Symbol.asyncDispose]().finally(() => {
                        if (sharedPool === shared) sharedPool = null;
                    });
                    await shared.closing;
                }
            })();
            return released;
        },
    };
}
