import { EventEmitter } from "events";
import { promiseMethod } from "../../utils/promise";

type Listener = {
    bivarianceHack(this: unknown, ...args: unknown[]): unknown;
}["bivarianceHack"];

export interface EventListenerRegistration {
    event: string | symbol;
    listener: Listener;
}

export interface EventObserver {
    register(registration: EventListenerRegistration): unknown;
    observeSync<T>(registration: unknown, action: () => T): T;
    observeAsync<T>(registration: unknown, action: () => T | Promise<T>): Promise<T>;
    observeSyncEmission<T>(event: string | symbol, action: () => T): T;
    observeAsyncEmission<T>(event: string | symbol, action: () => Promise<T>): Promise<T>;
    error(stage: string, error: unknown): void;
}

interface WrappedListener {
    original: Listener;
    registration: unknown;
}

export class AsyncEmitter extends EventEmitter {
    private _eventObserver?: EventObserver;
    private readonly _wrappedListeners = new WeakMap<Listener, WrappedListener>();
    private readonly _onceWrappers = new WeakMap<Listener, Listener>();
    private readonly _asyncDispatch = new WeakSet<Listener>();

    constructor(observer?: EventObserver) {
        super();
        this._eventObserver = observer;
    }

    setEventObserver(observer?: EventObserver): this {
        this._eventObserver = observer;
        return this;
    }

    override addListener(event: string | symbol, listener: Listener): this {
        return super.addListener(event, this._wrapListener(event, listener));
    }

    override on(event: string | symbol, listener: Listener): this {
        return super.on(event, this._wrapListener(event, listener));
    }

    override once(event: string | symbol, listener: Listener): this {
        const wrapped = this._wrapListener(event, listener);
        super.once(event, wrapped);
        const raw = super.rawListeners(event).at(-1) as Listener | undefined;
        if (raw && raw !== wrapped) {
            this._onceWrappers.set(raw, wrapped);
        }
        return this;
    }

    override prependListener(event: string | symbol, listener: Listener): this {
        return super.prependListener(event, this._wrapListener(event, listener));
    }

    override prependOnceListener(event: string | symbol, listener: Listener): this {
        const wrapped = this._wrapListener(event, listener);
        super.prependOnceListener(event, wrapped);
        const raw = super.rawListeners(event)[0] as Listener | undefined;
        if (raw && raw !== wrapped) {
            this._onceWrappers.set(raw, wrapped);
        }
        return this;
    }

    override removeListener(event: string | symbol, listener: Listener): this {
        const rawListeners = super.rawListeners(event) as Listener[];
        for (let index = rawListeners.length - 1; index >= 0; index -= 1) {
            const raw = rawListeners[index];
            if (raw === listener || this._unwrap(raw) === listener) {
                return super.removeListener(event, raw);
            }
        }

        return this;
    }

    override off(event: string | symbol, listener: Listener): this {
        return this.removeListener(event, listener);
    }

    override listeners(event: string | symbol): Listener[] {
        return super.listeners(event).map(listener => this._unwrap(listener as Listener));
    }

    override rawListeners(event: string | symbol): Listener[] {
        return super.rawListeners(event).map(rawListener => {
            const raw = rawListener as Listener;
            const onceWrapper = this._onceWrappers.get(raw);
            if (onceWrapper) {
                Object.defineProperty(raw, "listener", {
                    configurable: true,
                    value: this._unwrap(onceWrapper),
                });
                return raw;
            }

            return this._wrappedListeners.has(raw) ? this._unwrap(raw) : raw;
        });
    }

    override emit(event: string | symbol, ...args: unknown[]): boolean {
        const normalizedArgs =
            event === "newListener" || event === "removeListener"
                ? args.map((argument, index) =>
                      index === 1 && typeof argument === "function" ? this._unwrap(argument as Listener) : argument,
                  )
                : args;
        const action = (): boolean => super.emit(event, ...normalizedArgs);

        if (!this._eventObserver) {
            return action();
        }

        return this._observeSyncSafely(
            trackedAction => this._eventObserver!.observeSyncEmission(event, trackedAction),
            action,
        );
    }

    async emitAndWait(event: string | symbol, ...args: unknown[]): Promise<unknown[]> {
        const dispatch = async (): Promise<unknown[]> => {
            const results = await Promise.allSettled(
                super.rawListeners(event).map(rawListener => {
                    const listener = rawListener as Listener;
                    const wrapped = this._resolveWrapped(listener);
                    const action = (): Promise<unknown> => {
                        if (wrapped) {
                            this._asyncDispatch.add(wrapped.wrapper);
                        }
                        return promiseMethod(listener).apply(this, args);
                    };

                    return this._eventObserver && wrapped
                        ? this._observeAsyncSafely(
                              trackedAction =>
                                  this._eventObserver!.observeAsync(wrapped.metadata.registration, trackedAction),
                              action,
                          )
                        : action();
                }),
            );

            const rejected = results.find(({ status }) => status === "rejected");
            return rejected
                ? Promise.reject((rejected as PromiseRejectedResult).reason)
                : results.map(r => (r as PromiseFulfilledResult<unknown>).value);
        };

        return this._eventObserver
            ? this._observeAsyncSafely(
                  trackedAction => this._eventObserver!.observeAsyncEmission(event, trackedAction),
                  dispatch,
              )
            : dispatch();
    }

    private _wrapListener(event: string | symbol, listener: Listener): Listener {
        const observer = this._eventObserver;
        if (!observer) {
            return listener;
        }
        if (this._resolveWrapped(listener)) {
            return listener;
        }

        let registration: unknown;
        try {
            registration = observer.register({ event, listener });
        } catch (error) {
            this._reportObserverError("event.register", error);
            return listener;
        }

        const asyncDispatch = this._asyncDispatch;
        const observeSyncSafely = this._observeSyncSafely.bind(this);
        const wrapped = function (this: unknown, ...args: unknown[]): unknown {
            if (asyncDispatch.has(wrapped)) {
                asyncDispatch.delete(wrapped);
                return listener.apply(this, args);
            }

            const action = (): unknown => listener.apply(this, args);
            return observeSyncSafely(trackedAction => observer.observeSync(registration, trackedAction), action);
        };
        Object.defineProperty(wrapped, "listener", { configurable: true, value: listener });
        this._wrappedListeners.set(wrapped, { original: listener, registration });
        return wrapped;
    }

    private _resolveWrapped(listener: Listener):
        | {
              wrapper: Listener;
              metadata: WrappedListener;
          }
        | undefined {
        let current = this._onceWrappers.get(listener) ?? listener;
        const visited = new Set<Listener>();
        while (!visited.has(current)) {
            visited.add(current);
            const metadata = this._wrappedListeners.get(current);
            if (metadata) {
                return { wrapper: current, metadata };
            }
            const nested = (current as { listener?: unknown }).listener;
            if (typeof nested !== "function") {
                return;
            }
            current = nested as Listener;
        }

        return;
    }

    private _unwrap(listener: Listener): Listener {
        return this._resolveWrapped(listener)?.metadata.original ?? listener;
    }

    private _observeSyncSafely<T>(observe: (trackedAction: () => T) => T, action: () => T): T {
        let actionCalled = false;
        let actionCompleted = false;
        let actionFailed = false;
        let actionResult: T;
        let actionError: unknown;
        const trackedAction = (): T => {
            if (actionCalled) {
                if (actionFailed) {
                    throw actionError;
                }
                return actionResult!;
            }
            actionCalled = true;
            try {
                actionResult = action();
                actionCompleted = true;
                return actionResult;
            } catch (error) {
                actionFailed = true;
                actionError = error;
                throw error;
            }
        };

        try {
            observe(trackedAction);
            if (actionFailed) {
                throw actionError;
            }
            if (!actionCalled) {
                this._reportObserverError("event.observe", new Error("Event observer did not invoke the action"));
                return action();
            }
            return actionResult!;
        } catch (error) {
            if (actionFailed) {
                throw actionError;
            }
            this._reportObserverError("event.observe", error);
            if (actionCalled && actionCompleted) {
                return actionResult!;
            }
            return action();
        }
    }

    private async _observeAsyncSafely<T>(
        observe: (trackedAction: () => Promise<T>) => Promise<T>,
        action: () => Promise<T>,
    ): Promise<T> {
        let actionCalled = false;
        let actionPromise: Promise<T> | undefined;
        let actionFailed = false;
        let actionError: unknown;
        const trackedAction = (): Promise<T> => {
            if (actionPromise) {
                return actionPromise;
            }
            actionCalled = true;
            try {
                actionPromise = Promise.resolve(action()).catch(error => {
                    actionFailed = true;
                    actionError = error;
                    throw error;
                });
            } catch (error) {
                actionFailed = true;
                actionError = error;
                actionPromise = Promise.reject(error);
            }
            return actionPromise;
        };
        try {
            await observe(trackedAction);
            if (actionFailed) {
                throw actionError;
            }
            if (!actionCalled) {
                this._reportObserverError("event.observe", new Error("Event observer did not invoke the action"));
                return action();
            }
            return actionPromise!;
        } catch (error) {
            if (actionFailed) {
                throw actionError;
            }
            this._reportObserverError("event.observe", error);
            return actionCalled ? actionPromise! : action();
        }
    }

    private _reportObserverError(stage: string, error: unknown): void {
        try {
            this._eventObserver?.error(stage, error);
        } catch {
            // Profiling diagnostics are fail-open.
        }
    }
}
