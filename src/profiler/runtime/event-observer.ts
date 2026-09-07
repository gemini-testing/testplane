import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ErrorStackParser from "error-stack-parser";
import type { Config } from "../../config";
import type { EventListenerRegistration, EventObserver } from "../../events/async-emitter";
import { ProfilerSanitizer } from "../sanitize";
import type { ProfilerManager } from "../manager";
import type { SourceRef } from "../schema";

interface ProfilerEventRegistration {
    event: string;
    functionName: string;
    origin: "internal" | "user";
    source?: SourceRef;
}

class ProfilerEventObserver implements EventObserver {
    private readonly _sanitizer = new ProfilerSanitizer();
    private readonly _plugins: Array<{ name: string; root: string }>;

    constructor(private readonly _manager: ProfilerManager, config: Config) {
        this._plugins = buildPluginIndex(Object.keys(config.plugins ?? {}));
    }

    register({ event, listener }: EventListenerRegistration): ProfilerEventRegistration {
        const source = this._captureSource(listener.name);
        return {
            event: String(event),
            functionName: listener.name || "<anonymous>",
            origin: source?.internal ? "internal" : "user",
            source: source?.ref,
        };
    }

    observeSync<T>(registration: unknown, action: () => T): T {
        return this._observe(registration as ProfilerEventRegistration, action);
    }

    async observeAsync<T>(registration: unknown, action: () => T | Promise<T>): Promise<T> {
        return this._observe(registration as ProfilerEventRegistration, action);
    }

    observeSyncEmission<T>(event: string | symbol, action: () => T): T {
        return this._manager.runtime.withSpan(
            "event.emit",
            { minLevel: 2, name: String(event), attributes: { event: String(event), dispatch: "sync" } },
            action,
        );
    }

    observeAsyncEmission<T>(event: string | symbol, action: () => Promise<T>): Promise<T> {
        return this._manager.runtime.withSpan(
            "event.emit",
            { minLevel: 2, name: String(event), attributes: { event: String(event), dispatch: "async" } },
            action,
        );
    }

    error(stage: string, error: unknown): void {
        this._manager.runtime.recordError(stage, error);
    }

    private _observe<T>(registration: ProfilerEventRegistration, action: () => T): T {
        const { origin } = registration;
        return this._manager.runtime.withSpan(
            "event.listener",
            {
                minLevel: 2,
                name: `${origin === "internal" ? "internal:" : ""}${registration.event}:${registration.functionName}`,
                source: registration.source,
                attributes: {
                    event: registration.event,
                    function: registration.functionName,
                    plugin: registration.source?.plugin ?? null,
                    origin,
                },
            },
            action,
        );
    }

    private _captureSource(functionName?: string): { internal: boolean; ref: SourceRef } | undefined {
        try {
            const frames = ErrorStackParser.parse(new Error());
            const frame = frames.find(candidate => {
                const file = (candidate.fileName ?? "").replaceAll("\\", "/");
                return (
                    file &&
                    !file.includes("/src/profiler/") &&
                    !file.includes("/src/events/async-emitter/") &&
                    !file.startsWith("node:") &&
                    !file.includes("node:internal")
                );
            });
            if (!frame?.fileName) {
                return { internal: false, ref: { functionName, confidence: "low" } };
            }

            const fileName = frame.fileName.startsWith("file:") ? fileURLToPath(frame.fileName) : frame.fileName;
            const realFile = safeRealpath(fileName);
            const plugin = this._plugins.find(candidate => isInside(realFile, candidate.root));
            return {
                internal: isTestplaneSource(realFile),
                ref: {
                    file: this._sanitizer.path(realFile),
                    line: frame.lineNumber,
                    column: frame.columnNumber,
                    functionName,
                    plugin: plugin?.name,
                    confidence: plugin ? "high" : "medium",
                },
            };
        } catch (error) {
            this.error("event.source", error);
            return { internal: false, ref: { functionName, confidence: "low" } };
        }
    }
}

function buildPluginIndex(pluginNames: string[]): Array<{ name: string; root: string }> {
    return pluginNames.flatMap(name => {
        const entry = resolvePlugin(name) ?? resolvePlugin(`hermione-${name}`);
        if (!entry) {
            return [];
        }

        return [{ name, root: findPackageRoot(entry) }];
    });
}

function resolvePlugin(name: string): string | undefined {
    try {
        return require.resolve(name, { paths: [process.cwd()] });
    } catch {
        return;
    }
}

function findPackageRoot(entry: string): string {
    let current = path.dirname(entry);
    while (current !== path.dirname(current)) {
        if (fs.existsSync(path.join(current, "package.json"))) {
            return current;
        }
        current = path.dirname(current);
    }
    return path.dirname(entry);
}

const testplaneRoot = findPackageRoot(__filename);

function isTestplaneSource(file: string): boolean {
    const relative = path.relative(testplaneRoot, file).split(path.sep).join("/");
    return relative.startsWith("src/") || relative.startsWith("build/src/");
}

function safeRealpath(value: string): string {
    try {
        return fs.realpathSync.native(value);
    } catch {
        return path.resolve(value);
    }
}

function isInside(file: string, directory: string): boolean {
    const relative = path.relative(directory, file);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function createProfilerEventObserver(manager: ProfilerManager, config: Config): EventObserver | undefined {
    if (!manager.runtime.isEnabled(2)) {
        return;
    }

    return new ProfilerEventObserver(manager, config);
}
