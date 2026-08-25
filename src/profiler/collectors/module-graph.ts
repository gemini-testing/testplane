import { AsyncLocalStorage } from "node:async_hooks";
import { fileURLToPath } from "node:url";
import type { ModuleObserverRegistration } from "../../utils/module-observer-registry";
import { moduleObserverRegistry } from "../../utils/module-observer-registry";
import { ProfilerSanitizer } from "../sanitize";
import type { ProfilerRuntimeLike, SpanHandle } from "../runtime/types";

interface ModuleContext {
    ownerFile: string;
    stack: SpanHandle[];
}

interface LoadToken {
    span: SpanHandle;
}

export class ProfilerModuleGraphCollector {
    private readonly _context = new AsyncLocalStorage<ModuleContext>();
    private readonly _sanitizer = new ProfilerSanitizer();
    private readonly _registration: ModuleObserverRegistration;
    private _restore?: () => void;

    constructor(private readonly _runtime: ProfilerRuntimeLike) {
        this._registration = moduleObserverRegistry.register({
            onLoadStart: info => this._onLoadStart(info),
            onLoadEnd: (_info, token, error) => this._onLoadEnd(token as LoadToken | undefined, error),
            onError: error => this._runtime.recordError("moduleGraph", error),
        });
    }

    enterFile(file: string): void {
        this.leaveFile();
        const restoreRegistry = this._registration.enter();
        const previous = this._context.getStore();
        this._context.enterWith({ ownerFile: this._sanitizer.path(file), stack: [] });
        this._restore = (): void => {
            this._context.enterWith(previous ?? { ownerFile: "<unknown>", stack: [] });
            restoreRegistry();
        };
    }

    leaveFile(): void {
        this._restore?.();
        this._restore = undefined;
    }

    dispose(): void {
        this.leaveFile();
        this._registration.dispose();
    }

    private _onLoadStart(info: {
        request: string;
        resolved?: string;
        parent?: string;
        cacheHit: boolean;
        moduleSystem: "cjs" | "esm";
    }): LoadToken | undefined {
        const context = this._context.getStore();
        if (!context) {
            return;
        }
        const moduleName = normalizeModuleName(info.resolved ?? info.request, this._sanitizer);
        const parent = info.parent ? normalizeModuleName(info.parent, this._sanitizer) : null;
        const span = this._runtime.startSpan("module.load", {
            minLevel: 3,
            name: moduleName,
            parentId: context.stack.at(-1)?.id,
            attributes: {
                module: moduleName,
                parent,
                ownerFile: context.ownerFile,
                cacheHit: info.cacheHit,
                moduleSystem: info.moduleSystem,
            },
            quality: {
                timing: "exact",
                cpu: "thread",
                notes: [
                    info.moduleSystem === "cjs"
                        ? "CommonJS load/evaluation boundary"
                        : "ESM source load boundary; evaluation time is not attributed to this module",
                ],
            },
        });
        context.stack.push(span);
        this._runtime.increment(info.cacheHit ? "module.cacheHit" : "module.cacheMiss", 1, { module: moduleName });
        return { span };
    }

    private _onLoadEnd(token: LoadToken | undefined, error?: unknown): void {
        if (!token) {
            return;
        }
        token.span.end(error ? "failed" : "completed");
        const stack = this._context.getStore()?.stack;
        const index = stack?.lastIndexOf(token.span) ?? -1;
        if (index >= 0) {
            stack!.splice(index, 1);
        }
    }
}

function normalizeModuleName(value: string, sanitizer: ProfilerSanitizer): string {
    if (value.startsWith("node:")) {
        return value;
    }
    if (!value.includes("/") && !value.includes("\\")) {
        return value.slice(0, 200);
    }
    if (value.startsWith("file:")) {
        try {
            return sanitizer.path(fileURLToPath(value));
        } catch {
            return "<invalid-module-url>";
        }
    }
    return sanitizer.path(value);
}
