import Hermione from './hermione';
import * as RuntimeConfig from '../config/runtime-config';
import Bluebird from 'bluebird';
import debugFactory from 'debug';
import ipc from '../utils/ipc';

const debug = debugFactory(`hermione:worker:${process.pid}`);

export default class HermioneFacade {
    public promise: Promise<any>;
    private _hermione: Hermione | null;

    public static create(): HermioneFacade {
        return new HermioneFacade();
    }

    constructor() {
        this.promise = Bluebird.resolve();
        this._hermione = null;
    }

    public init(): Promise<any> {
        this.init = () => this.promise;

        this.promise = this._init()
            .then((hermione) => this._hermione = hermione)
            .then(() => (this._hermione as Hermione).init());

        return this.promise;
    }

    public syncConfig(): Promise<any> {
        this.syncConfig = () => this.promise;

        this.promise = this.init()
            .then(() => this._syncConfig());

        return this.promise;
    }

    public async runTest(...args: any[]) {
        return this.syncConfig()
            .then(() => this._hermione.runTest(...args));
    }

    private _init(): Promise<Hermione> {
        return new Bluebird((resolve, reject) => {
            debug('init worker');

            ipc.on('master.init', ({configPath, runtimeConfig} = {}) => {
                try {
                    if (runtimeConfig.requireModules) {
                        runtimeConfig.requireModules.forEach((module) => require(module));
                    }

                    RuntimeConfig.getInstance().extend(runtimeConfig);
                    const hermione = Hermione.create(configPath);

                    debug('worker initialized');
                    resolve(hermione);
                } catch (e) {
                    debug('worker initialization failed');
                    reject(e);
                }
            });

            ipc.emit('worker.init');
        });
    }

    private _syncConfig(): Promise<void> {
        return new Bluebird((resolve) => {
            debug('sync config');

            ipc.on('master.syncConfig', ({config} = {}) => {
                delete config.system.mochaOpts.grep;  // grep affects only master
                this._hermione.config.mergeWith(config);

                debug('config synced');
                resolve();
            });

            ipc.emit('worker.syncConfig');
        });
    }
};
