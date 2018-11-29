'use strict';

const workerFarm = require('@gemini-testing/worker-farm');
const Promise = require('bluebird');
const RuntimeConfig = require('../config/runtime-config');

module.exports = class Workers {
    static create(...args) {
        return new Workers(...args);
    }

    constructor(config) {
        this._config = config;

        this._workers = this._createWorkerFarm();
        this._runTest = Promise.promisify(this._workers.runTest);
        this._ended = false;
    }

    runTest(fullTitle, opts) {
        return this._runTest(fullTitle, opts);
    }

    end() {
        this._ended = true;
        workerFarm.end(this._workers);
    }

    isEnded() {
        return this._ended;
    }

    _createWorkerFarm() {
        const workerFilepath = require.resolve('../worker');

        const params = {
            maxConcurrentWorkers: this._config.system.workers,
            maxCallsPerWorker: this._config.system.testsPerWorker,
            maxConcurrentCallsPerWorker: Infinity,
            autoStart: true,
            maxRetries: 0,
            onChild: (child) => this._initChild(child),
            ...this._inspectParams()
        };

        return workerFarm(params, workerFilepath, ['runTest']);
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
