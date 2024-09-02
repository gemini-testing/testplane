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

    syncConfig(): Promise<void> {
        this.syncConfig = (): Promise<void> => this.promise;

        this.promise = this.init().then(() => this._syncConfig());

        return this.promise;
    }

    runTest(fullTitle: string, options: WorkerRunTestOpts): Promise<WorkerRunTestResult> {
        return this.syncConfig().then(() => this._testplane!.runTest(fullTitle, options));
    }

    private _init(): Promise<Testplane> {
        return new Promise((resolve, reject) => {
            debug("init worker");

            ipc.on(
                MASTER_INIT,
                ({
                    configPath,
                    runtimeConfig,
                }: {
                    configPath: string;
                    runtimeConfig: { requireModules?: string[] };
                }) => {
                    try {
                        const promise = Promise.resolve();

                        if (runtimeConfig.requireModules) {
                            runtimeConfig.requireModules.forEach(modulePath => {
                                promise.then(() => requireModule(modulePath as string));
                            });
                        }

                        RuntimeConfig.getInstance().extend(runtimeConfig);
                        const testplane = Testplane.create(configPath);

                        promise.then(() => {
                            debug("worker initialized");
                            resolve(testplane);
                        });
                    } catch (e) {
                        debug("worker initialization failed");
                        reject(e);
                    }
                },
            );

            ipc.emit(WORKER_INIT);
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
};
