'use strict';

const workerFarm = require('worker-farm');
const Promise = require('bluebird');
const RuntimeConfig = require('../config/runtime-config');

module.exports = class WorkersRegistry {
    static create(...args) {
        return new WorkersRegistry(...args);
    }

    constructor(config) {
        this._config = config;
        this._workerFarm = this._createWorkerFarm();
        this._ended = false;
    }

    async end() {
        this._ended = true;
        await Promise.promisify(workerFarm.end)(this._workerFarm);
    }

    isEnded() {
        return this._ended;
    }

    register(workerFilepath, exportedMethods) {
        const workers = {};
        for (const methodName of exportedMethods) {
            workers[methodName] = (...args) => {
                if (this._ended) {
                    return Promise.reject(new Error(`Can't execute method '${methodName}' because worker farm ended.`));
                }
                return Promise.promisify(this._workerFarm)(workerFilepath, methodName, args);
            };
        }
        return workers;
    }

    _createWorkerFarm() {
        const workerFilepath = require.resolve('./processor');

        const params = {
            maxConcurrentWorkers: this._config.system.workers,
            maxCallsPerWorker: this._config.system.testsPerWorker,
            maxConcurrentCallsPerWorker: Infinity,
            autoStart: true,
            maxRetries: 0,
            onChild: (child) => this._initChild(child),
            ...this._inspectParams()
        };

        return workerFarm(params, workerFilepath);
    }

    _inspectParams() {
        const runtimeConfig = RuntimeConfig.getInstance();

        if (!runtimeConfig || !runtimeConfig.inspectMode) {
            return;
        }

        const {inspect, inspectBrk} = runtimeConfig.inspectMode;

        const inspectName = inspectBrk ? 'inspect-brk' : 'inspect';
        let inspectValue = inspectBrk ? inspectBrk : inspect;

        inspectValue = typeof inspectValue === 'string' ? `=${inspectValue}` : '';

        return {
            workerOptions: {execArgv: [`--${inspectName}${inspectValue}`]},
            maxConcurrentWorkers: 1,
            maxCallsPerWorker: Infinity
        };
    }

    _initChild(child) {
        child.on('message', ({event} = {}) => {
            switch (event) {
                case 'worker.init':
                    child.send({
                        event: 'master.init',
                        configPath: this._config.configPath,
                        runtimeConfig: RuntimeConfig.getInstance()
                    });
                    break;
                case 'worker.syncConfig':
                    child.send({
                        event: 'master.syncConfig',
                        config: this._config.serialize()
                    });
                    break;
            }
        });
    }
};
