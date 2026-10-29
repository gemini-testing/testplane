import type { Config } from "../config";
import { MasterEvents } from "../events";
import signalHandler from "../signal-handler";
import type { BrowserBackend, BrowserBackendClient } from "./index";
import { createBackend, getBackendKey } from "./factory";

interface SharedBackend {
    backend: Promise<BrowserBackend>;
    users: number;
    closing: Promise<void> | null;
    stop(): Promise<void>;
}

const backends = new Map<string, SharedBackend>();

/** Standalone launches share infrastructure until their last owner releases it. */
export async function acquireStandaloneBackend(
    config: Config,
    id: string,
): Promise<AsyncDisposable & { backend: BrowserBackendClient }> {
    const key = JSON.stringify([
        getBackendKey(config.forBrowser(id)),
        config.browserDownloadMirrors,
        config.system.debug,
    ]);
    let shared = backends.get(key);
    if (shared?.closing) {
        await shared.closing.catch(() => null);
        return acquireStandaloneBackend(config, id);
    }
    if (!shared) {
        const entry: SharedBackend = {
            backend: createBackend(config, [id], 0),
            users: 0,
            closing: null,
            stop: (): Promise<void> => {
                entry.closing ??= (async (): Promise<void> => {
                    signalHandler.off(MasterEvents.EXIT, entry.stop);
                    try {
                        const backend = await entry.backend.catch(() => null);
                        await backend?.[Symbol.asyncDispose]();
                    } finally {
                        if (backends.get(key) === entry) backends.delete(key);
                    }
                })();
                return entry.closing;
            },
        };
        shared = entry;
        backends.set(key, entry);
        signalHandler.on(MasterEvents.EXIT, entry.stop);
    }
    const owner = shared;
    owner.users++;
    let released = false;
    const release = async (): Promise<void> => {
        if (released) return;
        released = true;
        if (--owner.users === 0) await owner.stop();
    };
    try {
        return { backend: await owner.backend, [Symbol.asyncDispose]: release };
    } catch (error) {
        await release();
        throw error;
    }
}
