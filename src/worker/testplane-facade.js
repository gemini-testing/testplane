"use strict";

const { Testplane } = require("./testplane");
const RuntimeConfig = require("../config/runtime-config");
const Promise = require("bluebird");
const debug = require("debug")(`testplane:worker:${process.pid}`);
const ipc = require("../utils/ipc");
const { MASTER_INIT, MASTER_SYNC_CONFIG, WORKER_INIT, WORKER_SYNC_CONFIG } = require("../constants/process-messages");
const { requireModule } = require("../utils/module");

module.exports = class TestplaneFacade {
    static create() {
        return new this();
    }

    constructor() {
        this.promise = Promise.resolve();
        this._testplane = null;
    }

    init() {
        this.init = () => this.promise;

        this.promise = this._init()
            .then(testplane => (this._testplane = testplane))
            .then(() => this._testplane.init());

        return this.promise;
    }

    syncConfig() {
        this.syncConfig = () => this.promise;

        this.promise = this.init().then(() => this._syncConfig());

        return this.promise;
    }

    runTest(...args) {
        return this.syncConfig().then(() => this._testplane.runTest(...args));
    }

    _init() {
        return new Promise((resolve, reject) => {
            debug("init worker");

            ipc.on(MASTER_INIT, ({ configPath, runtimeConfig } = {}) => {
                try {
                    const promise = Promise.resolve();

                    if (runtimeConfig.requireModules) {
                        runtimeConfig.requireModules.forEach(modulePath => {
                            promise.then(requireModule(modulePath));
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
            });

            ipc.emit(WORKER_INIT);
        });
    }

    _syncConfig() {
        return new Promise(resolve => {
            debug("sync config");

            ipc.on(MASTER_SYNC_CONFIG, ({ config } = {}) => {
                delete config.system.mochaOpts.grep; // grep affects only master
                this._testplane.config.mergeWith(config);

                debug("config synced");
                resolve();
            });

            ipc.emit(WORKER_SYNC_CONFIG);
        });
    }
};
