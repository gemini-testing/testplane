import { Testplane, WorkerRunTestOpts, WorkerRunTestResult } from "./testplane";
import RuntimeConfig from "../config/runtime-config";
import debug from "debug";
import ipc from "../utils/ipc";
import { MASTER_INIT, MASTER_SYNC_CONFIG, WORKER_INIT, WORKER_SYNC_CONFIG } from "../constants/process-messages";
import { requireModule } from "../utils/module";
import { Config } from "../config";

debug(`testplane:worker:${process.pid}`);

module.exports = class TestplaneFacade {
    promise: Promise<void>;
    _testplane: Testplane | null;
    _workerInstanceId?: string;

    static create(): TestplaneFacade {
        return new this();
    }

    constructor() {
        this.promise = Promise.resolve();
        this._testplane = null;
    }

    init(): Promise<void> {
        this.init = (): Promise<void> => this.promise;

        this.promise = this._init()
            .then(testplane => (this._testplane = testplane))
            .then(() => this._testplane!.init());

        return this.promise;
    }

    cancel(): void {
        RuntimeConfig.getInstance().replServer?.close();
    }

    syncConfig(): Promise<void> {
        this.syncConfig = (): Promise<void> => this.promise;

        this.promise = this.init().then(() => this._syncConfig());

        return this.promise;
    }

    runTest(fullTitle: string, options: WorkerRunTestOpts): Promise<WorkerRunTestResult> {
        return this.syncConfig()
            .then(() => this._testplane!.runTest(fullTitle, options))
            .then(
                result => this._decorateFragment(result),
                error => {
                    this._decorateFragment(error);
                    throw error;
                },
            );
    }

    async flushProfiler(): Promise<ReturnType<Testplane["takeProfilerFragment"]>> {
        await this.promise;
        const fragment = this._testplane?.takeProfilerFragment() ?? null;
        if (fragment && this._workerInstanceId) {
            fragment.process.workerInstanceId = this._workerInstanceId;
        }
        return fragment;
    }

    async profilerLevel(): Promise<0 | 1 | 2 | 3> {
        await this.promise;
        return this._testplane?.profilerLevel() ?? 0;
    }

    private _init(): Promise<Testplane> {
        return new Promise((resolve, reject) => {
            debug("init worker");

            ipc.on(
                MASTER_INIT,
                ({
                    configPath,
                    runtimeConfig,
                    profiler,
                }: {
                    configPath: string;
                    runtimeConfig: { requireModules?: string[] };
                    profiler?: {
                        runId?: string;
                        workerInstanceId?: string;
                        clockSync?: {
                            workerSentAtEpochMs: number;
                            masterReceivedAtEpochMs: number;
                            masterSentAtEpochMs: number;
                        };
                    };
                }) => {
                    try {
                        const clockAlignment = calculateClockAlignment(profiler?.clockSync, Date.now());
                        this._workerInstanceId = profiler?.workerInstanceId;
                        let promise = Promise.resolve();

                        if (runtimeConfig.requireModules) {
                            runtimeConfig.requireModules.forEach(modulePath => {
                                promise = promise.then(() => requireModule(modulePath as string));
                            });
                        }

                        promise = promise
                            .then(async () => {
                                RuntimeConfig.getInstance().extend(runtimeConfig);
                                const testplane = await Testplane.create(configPath, undefined, {
                                    runId: profiler?.runId,
                                    clockOffsetMs: clockAlignment?.offsetMs,
                                    clockUncertaintyMs: clockAlignment?.uncertaintyMs,
                                    process: {
                                        type: "worker",
                                        pid: process.pid,
                                        workerInstanceId: profiler?.workerInstanceId,
                                    },
                                });

                                debug("worker initialized");
                                resolve(testplane);
                            })
                            .catch(reject);
                    } catch (e) {
                        debug("worker initialization failed");
                        reject(e);
                    }
                },
            );

            ipc.emit(WORKER_INIT, { profilerClock: { sentAtEpochMs: Date.now() } });
        });
    }

    _syncConfig(): Promise<void> {
        return new Promise(resolve => {
            debug("sync config");

            ipc.on(MASTER_SYNC_CONFIG, ({ config }: { config: Config }) => {
                delete config.system.mochaOpts.grep; // grep affects only master
                this._testplane!.config.mergeWith(config);

                debug("config synced");
                resolve();
            });

            ipc.emit(WORKER_SYNC_CONFIG);
        });
    }

    private _decorateFragment<T>(container: T): T {
        const fragment = (container as { profileFragment?: { process: { workerInstanceId?: string } } } | null)
            ?.profileFragment;
        if (fragment && this._workerInstanceId) {
            fragment.process.workerInstanceId = this._workerInstanceId;
        }
        return container;
    }
};

function calculateClockAlignment(
    sync:
        | {
              workerSentAtEpochMs: number;
              masterReceivedAtEpochMs: number;
              masterSentAtEpochMs: number;
          }
        | undefined,
    workerReceivedAtEpochMs: number,
): { offsetMs: number; uncertaintyMs: number } | undefined {
    if (
        !sync ||
        ![
            sync.workerSentAtEpochMs,
            sync.masterReceivedAtEpochMs,
            sync.masterSentAtEpochMs,
            workerReceivedAtEpochMs,
        ].every(Number.isFinite)
    ) {
        return;
    }

    const masterProcessingMs = sync.masterSentAtEpochMs - sync.masterReceivedAtEpochMs;
    const roundTripMs = workerReceivedAtEpochMs - sync.workerSentAtEpochMs - masterProcessingMs;
    if (masterProcessingMs < 0 || roundTripMs < 0) {
        return;
    }

    return {
        offsetMs:
            (sync.masterReceivedAtEpochMs -
                sync.workerSentAtEpochMs +
                (sync.masterSentAtEpochMs - workerReceivedAtEpochMs)) /
            2,
        uncertaintyMs: roundTripMs / 2,
    };
}
