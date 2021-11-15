import { EventEmitter } from 'events';
import workerFarm from 'worker-farm';
import Bluebird from 'bluebird';
import _ from 'lodash';
import { ChildProcess } from 'child_process';

import WorkerProcess from './worker-process';
import * as RuntimeConfig from '../config/runtime-config';
import Events from '../constants/runner-events';

import type Config from '../config';

export default class WorkersRegistry extends EventEmitter {
    private _config: Config;
    private _ended: boolean;
    private _workerFarm: workerFarm.Workers | null;
    private _registeredWorkers: Array<EventEmitter>;

    static create(config: Config): WorkersRegistry {
        return new WorkersRegistry(config);
    }

    constructor(config: Config) {
        super();
        this._config = config;
        this._ended = false;
        this._workerFarm = null;
        this._registeredWorkers = [];
    }

    public init(): void {
        if (this._workerFarm) {
            return;
        }

        this._workerFarm = this._createWorkerFarm();
    }

    public async end(): Promise<void> {
        this._ended = true;

        if (this._workerFarm) {
            await Bluebird.promisify(workerFarm.end)(this._workerFarm);
        }
    }

    public isEnded(): boolean {
        return this._ended;
    }

    public register<T>(workerFilepath: string, exportedMethods: Array<keyof T>): EventEmitter & Pick<T, typeof exportedMethods[number]> {
        const workers: EventEmitter = new EventEmitter();
        this._registeredWorkers.push(workers);

        for (const methodName of exportedMethods) {
            workers[methodName] = (...args: Array<any>) => {
                if (this._ended) {
                    return Bluebird.reject(new Error(`Can't execute method '${String(methodName)}' because worker farm ended.`));
                }

                if (this._workerFarm) {
                    return (Bluebird.promisify(this._workerFarm) as (arg1: any, arg2: any, arg3: any) => any)(workerFilepath, methodName, args);
                }
            };
        }

        return workers as EventEmitter & Pick<T, typeof exportedMethods[number]>;
    }

    private _createWorkerFarm(): workerFarm.Workers {
        const workerFilepath = require.resolve('./processor');

        const params = {
            maxConcurrentWorkers: this._config.system.workers,
            maxCallsPerWorker: this._config.system.testsPerWorker,
            maxConcurrentCallsPerWorker: Infinity,
            autoStart: true,
            maxRetries: 0,
            onChild: (child: ChildProcess) => this._initChild(child),
            ...this._inspectParams()
        };

        return workerFarm(params, workerFilepath);
    }

    private _inspectParams(): workerFarm.FarmOptions {
        const runtimeConfig = RuntimeConfig.getInstance();

        if (!runtimeConfig || !runtimeConfig.inspectMode) {
            return {};
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

    private _initChild(child: ChildProcess): void {
        child.on('message', (data: any = {}) => {
            switch (data.event) {
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
                default:
                    if (data.event) {
                        this._registeredWorkers.forEach((workers) => workers.emit(data.event, _.omit(data, 'event')));
                    }
                    break;
            }
        });

        this.emit(Events.NEW_WORKER_PROCESS, WorkerProcess.create(child));
    }
};
