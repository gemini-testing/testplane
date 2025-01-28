"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const testplane_1 = require("./testplane");
const runtime_config_1 = __importDefault(require("../config/runtime-config"));
const debug_1 = __importDefault(require("debug"));
const ipc_1 = __importDefault(require("../utils/ipc"));
const process_messages_1 = require("../constants/process-messages");
const module_1 = require("../utils/module");
(0, debug_1.default)(`testplane:worker:${process.pid}`);
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
    cancel() {
        runtime_config_1.default.getInstance().replServer?.close();
    }
    syncConfig() {
        this.syncConfig = () => this.promise;
        this.promise = this.init().then(() => this._syncConfig());
        return this.promise;
    }
    runTest(fullTitle, options) {
        return this.syncConfig().then(() => this._testplane.runTest(fullTitle, options));
    }
    _init() {
        return new Promise((resolve, reject) => {
            (0, debug_1.default)("init worker");
            ipc_1.default.on(process_messages_1.MASTER_INIT, ({ configPath, runtimeConfig, }) => {
                try {
                    const promise = Promise.resolve();
                    if (runtimeConfig.requireModules) {
                        runtimeConfig.requireModules.forEach(modulePath => {
                            promise.then(() => (0, module_1.requireModule)(modulePath));
                        });
                    }
                    runtime_config_1.default.getInstance().extend(runtimeConfig);
                    const testplane = testplane_1.Testplane.create(configPath);
                    promise.then(() => {
                        (0, debug_1.default)("worker initialized");
                        resolve(testplane);
                    });
                }
                catch (e) {
                    (0, debug_1.default)("worker initialization failed");
                    reject(e);
                }
            });
            ipc_1.default.emit(process_messages_1.WORKER_INIT);
        });
    }
    _syncConfig() {
        return new Promise(resolve => {
            (0, debug_1.default)("sync config");
            ipc_1.default.on(process_messages_1.MASTER_SYNC_CONFIG, ({ config }) => {
                delete config.system.mochaOpts.grep; // grep affects only master
                this._testplane.config.mergeWith(config);
                (0, debug_1.default)("config synced");
                resolve();
            });
            ipc_1.default.emit(process_messages_1.WORKER_SYNC_CONFIG);
        });
    }
};
//# sourceMappingURL=testplane-facade.js.map