'use strict';

const workerFarm = require('worker-farm');
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
    }

    runTest(fullTitle, opts) {
        return this._runTest(fullTitle, opts);
    }

    end() {
        workerFarm.end(this._workers);
    }

    _createWorkerFarm() {
        const workerFilepath = require.resolve('../worker');
        const params = {
            maxConcurrentWorkers: this._config.system.workers,
            maxCallsPerWorker: this._config.system.testsPerWorker,
            maxConcurrentCallsPerWorker: Infinity,
            autoStart: true,
            maxRetries: 0,
            onChild: (child) => this._initChild(child)
        };

        return workerFarm(params, workerFilepath, ['runTest']);
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
