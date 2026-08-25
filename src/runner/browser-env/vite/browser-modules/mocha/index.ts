import { TestParser } from "./parser.js";
import { wrapConsoleMethods } from "../utils/index.js";
import { getErrorsOnPageLoad, getErrorsOnRunRunnable, BrowserError } from "../errors/index.js";
import { BrowserEventNames, WorkerEventNames, type BrowserViteSocket, type RunnableFn } from "../types.js";

interface BrowserTelemetryStart {
    /** Browser monotonic clock value captured before the runnable started. */
    startedAt: number;
    /** Number of Resource Timing entries that already existed before the runnable started. */
    resourceCount: number;
    /** Number of Long Task entries that already existed before the runnable started. */
    longTaskCount: number;
}

export class MochaWrapper {
    private _runnables = new Map<string, Mocha.Runnable>();
    private _parser: TestParser;
    private _socket: BrowserViteSocket;

    static create<T extends MochaWrapper>(this: new () => T): T {
        return new this();
    }

    constructor() {
        this._socket = window.__testplane__.socket;
        this._validate();

        this._parser = TestParser.create();
    }

    async init(): Promise<void> {
        mocha.setup("bdd");

        this._subscribeOnWorkerMessages();
        let error: Error | undefined = undefined;

        try {
            await this._parser.loadFile(window.__testplane__.file, runnable => {
                this._runnables.set(runnable.fullTitle(), runnable);
            });
        } catch (err) {
            error = err as Error;
        }

        this._socket.emit(BrowserEventNames.initialize, getErrorsOnPageLoad(error));

        wrapConsoleMethods();
    }

    private _validate(): never | void {
        if (!window.Mocha) {
            const error = BrowserError.create({
                message: "Can't find Mocha inside Testplane dependencies. Try to reinstall Testplane.",
            });

            this._socket.emit(BrowserEventNames.initialize, getErrorsOnPageLoad(error));
            throw error;
        }
    }

    private _subscribeOnWorkerMessages(): void {
        this._socket.on(WorkerEventNames.runRunnable, async (payload, cb): Promise<void> => {
            const runnableToRun = this._runnables.get(payload.fullTitle);

            if (!runnableToRun) {
                const error = BrowserError.create({
                    message: `Can't find a runnable with the title "${payload.fullTitle}" to run`,
                });

                cb(getErrorsOnRunRunnable(error));
                throw error;
            }

            let error: Error | undefined = undefined;
            const shouldProfile = (window.__testplane__.profilerLevel ?? 0) >= 3;
            const telemetryStart = shouldProfile ? tryStartBrowserTelemetry() : undefined;

            try {
                const ctx = { browser: window.__testplane__.browser };
                await (runnableToRun.fn as unknown as RunnableFn).call(ctx, ctx);
            } catch (err) {
                error = err as Error;
            }

            try {
                if (telemetryStart) {
                    const longTasks = performance.getEntriesByType("longtask").slice(telemetryStart.longTaskCount);
                    this._socket.emit(BrowserEventNames.profilerFragment, {
                        fullTitle: payload.fullTitle,
                        wallMs: Math.max(0, performance.now() - telemetryStart.startedAt),
                        resourceCount: Math.max(
                            0,
                            performance.getEntriesByType("resource").length - telemetryStart.resourceCount,
                        ),
                        longTaskCount: longTasks.length,
                        longTaskWallMs: longTasks.reduce((total, entry) => total + entry.duration, 0),
                        context: payload.profileContext,
                    });
                }
            } catch {
                // Profiling must never block the runnable ack / hang the worker.
            }

            return cb(getErrorsOnRunRunnable(error));
        });
    }
}

function tryStartBrowserTelemetry(): BrowserTelemetryStart | undefined {
    try {
        return {
            startedAt: performance.now(),
            resourceCount: performance.getEntriesByType("resource").length,
            longTaskCount: performance.getEntriesByType("longtask").length,
        };
    } catch {
        return;
    }
}
