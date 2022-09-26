'use strict';
const Hermione = require('./hermione');
const RuntimeConfig = require('../config/runtime-config');
const Promise = require('bluebird');
const debug = require('debug')(`hermione:worker:${process.pid}`);
const ipc = require('../utils/ipc');
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
            .then((hermione) => this._hermione = hermione)
            .then(() => this._hermione.init());
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
            ipc.on('master.init', ({ configPath, runtimeConfig } = {}) => {
                try {
                    if (runtimeConfig.requireModules) {
                        runtimeConfig.requireModules.forEach((module) => require(module));
                    }
                    RuntimeConfig.getInstance().extend(runtimeConfig);
                    const hermione = Hermione.create(configPath);
                    debug('worker initialized');
                    resolve(hermione);
                }
                catch (e) {
                    debug('worker initialization failed');
                    reject(e);
                }
            });
            ipc.emit('worker.init');
        });
    }
    _syncConfig() {
        return new Promise((resolve) => {
            debug('sync config');
            ipc.on('master.syncConfig', ({ config } = {}) => {
                delete config.system.mochaOpts.grep; // grep affects only master
                this._hermione.config.mergeWith(config);
                debug('config synced');
                resolve();
            });
            ipc.emit('worker.syncConfig');
        });
    }
};
