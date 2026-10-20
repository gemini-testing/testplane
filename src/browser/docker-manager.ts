import { randomUUID } from "crypto";
import type { Config } from "../config";
import type { DockerConfig } from "../config/types";
import type { WdProcess } from "../browser-pool/webdriver-pool";
import signalHandler from "../signal-handler";
import { MasterEvents } from "../events";
import { warn } from "../utils/logger";
import {
    checkDockerParallelism,
    startDockerController,
    type DockerBrowserEntry,
    type DockerBrowserOptions,
    type DockerController,
} from "./docker";

class DockerManager {
    private controller?: Promise<DockerController>;
    private queue: Promise<unknown> = Promise.resolve();
    private closed = false;
    private stopping?: Promise<void>;
    private onExit = (): Promise<void> => this.stop();
    private sessions = new Set<() => Promise<void>>();

    constructor(private entries: Map<string, DockerBrowserEntry>, private limit?: number, private timeout = 300_000) {
        signalHandler.once(MasterEvents.RUNNER_END, this.onExit);
    }

    acquire(
        id: string,
        config: DockerConfig | null,
        options: DockerBrowserOptions,
        closeBrowser: () => Promise<void>,
    ): Promise<WdProcess> {
        const acquire = async (): Promise<WdProcess> => {
            if (this.closed) throw new Error("The Docker browser run has already ended.");
            let entry = this.entries.get(id);
            const existing = Boolean(entry);
            if (!entry) {
                entry = { config, browserName: options.browserName || "", browserVersion: `testplane-${randomUUID()}` };
            }
            if (!this.controller) {
                this.entries.set(id, entry);
                this.controller = (async (): Promise<DockerController> => {
                    const limit = this.limit ?? (await checkDockerParallelism(0));
                    return startDockerController(
                        entry.config,
                        { timeout: this.timeout },
                        [...this.entries.values()],
                        limit,
                    );
                })();
            } else if (!existing) {
                await (await this.controller).addBrowser(entry);
                this.entries.set(id, entry);
            }
            const controller = await this.controller;
            if (this.closed) throw new Error("The Docker browser run has already ended.");
            const session = controller.createSession(entry.browserVersion, options.timeout || 30_000);
            this.sessions.add(closeBrowser);
            const release = async (): Promise<void> => {
                await session.free();
                this.sessions.delete(closeBrowser);
            };
            return { ...session, free: release, kill: release };
        };
        // Configuration reloads and first startup must be serialized, not WebDriver requests.
        const result = this.queue.then(acquire);
        this.queue = result.catch(() => undefined);
        return result;
    }

    get isStopping(): boolean {
        return this.closed;
    }

    stop(): Promise<void> {
        this.closed = true;
        signalHandler.off(MasterEvents.RUNNER_END, this.onExit);
        this.stopping ??= (async (): Promise<void> => {
            await this.queue;
            const results = await Promise.allSettled([...this.sessions].map(close => close()));
            results.forEach(result => {
                if (result.status === "rejected") warn(`Cannot close Docker session: ${result.reason}`);
            });
            // Failed startup already cleans up its partially created environment.
            const controller = await this.controller?.catch(() => undefined);
            await controller?.kill();
        })();
        return this.stopping;
    }
}

const runs = new WeakMap<Config, DockerManager>();

/** Register only selected browsers; unused browser configs need not be valid. */
export function configureDockerRun(config: Config, browserIds: string[], limit: number): void {
    if (runs.has(config)) throw new Error("A Docker run is already registered for this config.");
    const entries = new Map<string, DockerBrowserEntry>();
    let timeout = 0;
    for (const id of browserIds) {
        const browser = config.forBrowser(id);
        entries.set(id, {
            config: browser.docker,
            browserName: browser.desiredCapabilities?.browserName || "",
            browserVersion: `testplane-${randomUUID()}`,
        });
        timeout = Math.max(timeout, browser.sessionRequestTimeout || browser.httpTimeout);
    }
    runs.set(config, new DockerManager(entries, limit, timeout || 30_000));
}

export async function stopDockerRun(config: Config): Promise<void> {
    const manager = runs.get(config);
    try {
        await manager?.stop();
    } finally {
        if (runs.get(config) === manager) runs.delete(config);
    }
}

// Standalone calls have no runner. Concurrent calls share a controller until the last browser closes.
let standalone: { manager: DockerManager; users: number } | undefined;
let standaloneStopping: Promise<void> = Promise.resolve();

export async function runDockerBrowser(
    config: DockerConfig | null,
    options: DockerBrowserOptions,
    owner: Config,
    browserId: string,
    closeBrowser: () => Promise<void>,
): Promise<WdProcess> {
    const manager = runs.get(owner);
    if (manager) return manager.acquire(browserId, config, options, closeBrowser);

    await standaloneStopping;
    const state = (standalone ??= { manager: new DockerManager(new Map()), users: 0 });
    state.users++;
    const releaseOwner = async (): Promise<void> => {
        if (--state.users === 0) {
            if (standalone === state) standalone = undefined;
            // stop() may be awaiting closeBrowser(), which calls this release function.
            if (!state.manager.isStopping) {
                const stopping = state.manager.stop();
                // New launches wait for cleanup but must not inherit its failure.
                standaloneStopping = stopping.catch(() => undefined);
                await stopping;
            }
        }
    };
    try {
        const session = await state.manager.acquire(randomUUID(), config, options, closeBrowser);
        let released = false;
        let releasing: Promise<void> | undefined;
        const release = (): Promise<void> => {
            releasing ??= (async (): Promise<void> => {
                await session.free();
                if (!released) {
                    released = true;
                    await releaseOwner();
                }
            })().catch(error => {
                releasing = undefined;
                throw error;
            });
            return releasing;
        };
        return { ...session, free: release, kill: release };
    } catch (error) {
        await releaseOwner().catch(cleanupError => warn(String(cleanupError)));
        throw error;
    }
}
