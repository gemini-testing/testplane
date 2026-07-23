import { AsyncLocalStorage } from "node:async_hooks";
import { Module as UntypedModule } from "node:module";
import * as NodeModule from "node:module";

interface ResolveInfo {
    request: string;
    resolved?: string;
    parent?: string;
}

interface LoadInfo extends ResolveInfo {
    cacheHit: boolean;
    moduleSystem: "cjs" | "esm";
}

export interface ModuleLoadObserver {
    onResolve?(info: ResolveInfo): void;
    onLoadStart?(info: LoadInfo): unknown;
    onLoadEnd?(info: LoadInfo, token: unknown, error?: unknown): void;
    onError?(error: unknown): void;
}

export interface ModuleObserverRegistration {
    run<T>(action: () => T): T;
    enter(): () => void;
    dispose(): void;
}

// Node intentionally does not expose these CommonJS hooks in its public types.
type PatchableModule = typeof UntypedModule & {
    _resolveFilename: (request: string, ...args: unknown[]) => string | false;
    _load: (request: string, ...args: unknown[]) => unknown;
};

interface CommonJsHookState {
    active: boolean;
}

class ModuleObserverRegistry {
    private readonly _active = new AsyncLocalStorage<ModuleLoadObserver[]>();
    private readonly _insideCommonJsLoad = new AsyncLocalStorage<boolean>();
    private _registrationCount = 0;
    private _originalResolve?: PatchableModule["_resolveFilename"];
    private _originalLoad?: PatchableModule["_load"];
    private _installedResolve?: PatchableModule["_resolveFilename"];
    private _installedLoad?: PatchableModule["_load"];
    private _commonJsHookState?: CommonJsHookState;
    private _esmHooks?: NodeModule.ModuleHooks;

    register(observer: ModuleLoadObserver): ModuleObserverRegistration {
        this._registrationCount += 1;
        this._install();
        let disposed = false;

        return {
            run: <T>(action: () => T): T => {
                if (disposed) {
                    return action();
                }
                return this._active.run(this._appendObserver(observer), action);
            },
            enter: (): (() => void) => {
                if (disposed) {
                    return () => undefined;
                }
                const previous = this._active.getStore();
                this._active.enterWith(this._appendObserver(observer));
                return () => this._active.enterWith(previous ?? []);
            },
            dispose: (): void => {
                if (disposed) {
                    return;
                }
                disposed = true;
                this._registrationCount -= 1;
                if (this._registrationCount === 0) {
                    this._uninstall();
                }
            },
        };
    }

    private _appendObserver(observer: ModuleLoadObserver): ModuleLoadObserver[] {
        const current = this._active.getStore() ?? [];
        return current.includes(observer) ? current : [...current, observer];
    }

    private _install(): void {
        if (this._originalLoad) {
            return;
        }

        const Module = UntypedModule as PatchableModule;
        this._originalResolve = Module._resolveFilename;
        this._originalLoad = Module._load;
        this._commonJsHookState = { active: true };
        this._installCommonJsHooks(Module, this._originalResolve, this._originalLoad, this._commonJsHookState);
        this._installedResolve = Module._resolveFilename;
        this._installedLoad = Module._load;
        this._installEsmHooks();
    }

    private _installCommonJsHooks(
        Module: PatchableModule,
        originalResolve: PatchableModule["_resolveFilename"],
        originalLoad: PatchableModule["_load"],
        state: CommonJsHookState,
    ): void {
        const active = this._active;
        const insideCommonJsLoad = this._insideCommonJsLoad;
        const notify = this._notify.bind(this);
        const startLoad = this._startLoad.bind(this);
        const endLoad = this._endLoad.bind(this);

        Module._resolveFilename = function (request: string, ...args: unknown[]): string | false {
            const resolved = originalResolve.apply(this, [request, ...args] as Parameters<
                PatchableModule["_resolveFilename"]
            >);
            if (!state.active) {
                return resolved;
            }
            const observers = active.getStore();
            if (observers?.length) {
                notify(observers, observer =>
                    observer.onResolve?.({
                        request,
                        resolved: typeof resolved === "string" ? resolved : undefined,
                        parent: (args[0] as { filename?: string } | undefined)?.filename,
                    }),
                );
            }
            return resolved;
        };

        Module._load = function (request: string, ...args: unknown[]): unknown {
            const moduleArguments = [request, ...args] as Parameters<PatchableModule["_load"]>;
            if (!state.active) {
                return originalLoad.apply(this, moduleArguments);
            }
            const observers = active.getStore();
            if (!observers?.length) {
                return originalLoad.apply(this, moduleArguments);
            }

            let resolved: string | undefined;
            try {
                const result = originalResolve.apply(
                    this,
                    moduleArguments as Parameters<PatchableModule["_resolveFilename"]>,
                );
                resolved = typeof result === "string" ? result : undefined;
            } catch {
                // Resolution and its original error still belong to Module._load.
            }
            const info: LoadInfo = {
                request,
                resolved,
                parent: (args[0] as { filename?: string } | undefined)?.filename,
                cacheHit: Boolean(resolved && require.cache[resolved]),
                moduleSystem: "cjs",
            };
            const tokens = startLoad(observers, info);

            try {
                const result = insideCommonJsLoad.run(true, () => originalLoad.apply(this, moduleArguments));
                endLoad(observers, info, tokens);
                return result;
            } catch (error) {
                endLoad(observers, info, tokens, { error });
                throw error;
            }
        };
    }

    private _installEsmHooks(): void {
        if (typeof NodeModule.registerHooks !== "function") {
            return;
        }

        const active = this._active;
        const insideCommonJsLoad = this._insideCommonJsLoad;
        const notify = this._notify.bind(this);
        const startLoad = this._startLoad.bind(this);
        const endLoad = this._endLoad.bind(this);

        try {
            this._esmHooks = NodeModule.registerHooks({
                resolve(specifier, context, nextResolve) {
                    if (insideCommonJsLoad.getStore()) {
                        return nextResolve(specifier, context);
                    }
                    const result = nextResolve(specifier, context);
                    const observers = active.getStore();
                    if (observers?.length) {
                        notify(observers, observer =>
                            observer.onResolve?.({
                                request: specifier,
                                resolved: result.url,
                                parent: context.parentURL,
                            }),
                        );
                    }
                    return result;
                },
                load(url, context, nextLoad) {
                    if (insideCommonJsLoad.getStore()) {
                        return nextLoad(url, context);
                    }
                    const observers = active.getStore();
                    if (!observers?.length) {
                        return nextLoad(url, context);
                    }
                    const info: LoadInfo = {
                        request: url,
                        resolved: url,
                        parent: undefined,
                        cacheHit: false,
                        moduleSystem: "esm",
                    };
                    const tokens = startLoad(observers, info);
                    try {
                        const result = nextLoad(url, context);
                        endLoad(observers, info, tokens);
                        return result;
                    } catch (error) {
                        endLoad(observers, info, tokens, { error });
                        throw error;
                    }
                },
            });
        } catch {
            this._esmHooks = undefined;
        }
    }

    private _startLoad(observers: ModuleLoadObserver[], info: LoadInfo): unknown[] {
        return observers.map(observer => this._safe(observer, () => observer.onLoadStart?.(info)));
    }

    private _endLoad(
        observers: ModuleLoadObserver[],
        info: LoadInfo,
        tokens: unknown[],
        failure?: { error: unknown },
    ): void {
        observers.forEach((observer, index) => {
            this._safe(observer, () => {
                if (failure) {
                    observer.onLoadEnd?.(info, tokens[index], failure.error);
                } else {
                    observer.onLoadEnd?.(info, tokens[index]);
                }
            });
        });
    }

    private _notify(observers: ModuleLoadObserver[], action: (observer: ModuleLoadObserver) => void): void {
        for (const observer of observers) {
            this._safe(observer, () => action(observer));
        }
    }

    private _safe<T>(observer: ModuleLoadObserver, action: () => T): T | undefined {
        try {
            return action();
        } catch (error) {
            try {
                observer.onError?.(error);
            } catch {
                // Instrumentation must never affect module loading.
            }
            return;
        }
    }

    private _uninstall(): void {
        if (!this._originalLoad || !this._originalResolve) {
            return;
        }
        if (this._commonJsHookState) {
            this._commonJsHookState.active = false;
        }
        const Module = UntypedModule as PatchableModule;
        if (Module._resolveFilename === this._installedResolve) {
            Module._resolveFilename = this._originalResolve;
        }
        if (Module._load === this._installedLoad) {
            Module._load = this._originalLoad;
        }
        this._esmHooks?.deregister();
        this._esmHooks = undefined;
        this._originalResolve = undefined;
        this._originalLoad = undefined;
        this._installedResolve = undefined;
        this._installedLoad = undefined;
        this._commonJsHookState = undefined;
    }
}

export const moduleObserverRegistry = new ModuleObserverRegistry();
