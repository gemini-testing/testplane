'use strict';

const Hermione = require('./hermione');
const RuntimeConfig = require('../config/runtime-config');
const Promise = require('bluebird');
const debug = require('debug')(`hermione:worker:${process.pid}`);

module.exports = class HermioneFacade {
    static create() {
        return new HermioneFacade();
    }

    constructor() {
        this.promise = Promise.resolve();
        this._hermione = null;
    }

    init() {
        this.init = () => this.promise;

        this.promise = this._init()
            .then((hermione) => this._hermione = hermione);

        return this.promise;
    }

    syncConfig() {
        this.syncConfig = () => this.promise;

        this.promise = this.init()
            .then(() => this._syncConfig());

        return this.promise;
    }

    runTest(...args) {
        return this.syncConfig()
            .then(() => this._hermione.runTest(...args));
    }

    _init() {
        return new Promise((resolve, reject) => {
            debug('init worker');
            process.send({event: 'worker.init'});

            process.on('message', ({event, testFiles, configPath, runtimeConfig} = {}) => {
                if (event !== 'master.init') {
                    return;
                }

                try {
                    const hermione = Hermione.create(configPath);
                    hermione.init(testFiles);
                    RuntimeConfig.getInstance().extend(runtimeConfig);

                    debug('worker initialized');
                    resolve(hermione);
                } catch (e) {
                    debug('worker initialization failed');
                    reject(e);
                }
            });
        });
    }

    _syncConfig() {
        return new Promise((resolve) => {
            debug('sync config');
            process.send({event: 'worker.syncConfig'});

            process.on('message', ({event, config} = {}) => {
                if (event !== 'master.syncConfig') {
                    return;
                }

                delete config.system.mochaOpts.grep;  // grep affects only master

                this._hermione.config.mergeWith(config);

                debug('config synced');
                resolve();
            });
        });
    }
};
