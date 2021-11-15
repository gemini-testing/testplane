import _ from 'lodash';
import Bluebird from 'bluebird';
import { events } from 'gemini-core';
import pluginsLoader from 'plugins-loader';

import Config from './config';
import RunnerEvents from './constants/runner-events';
import  * as Errors from './errors';
import WorkerRunnerEvents from './worker/constants/runner-events';

import type { Config as ConfigType } from './types/config';
import type { Constructor } from './types/utils';

const PREFIX = require('../package').name + '-';

export type Interceptor = {
    event: string | symbol;
    handler: (...args: Array<any>) => any;
};

export interface BaseHermioneEvents {
    [RunnerEvents.INIT]: () => void;
}

declare interface BaseHermione {
    on<U extends keyof BaseHermioneEvents>(event: U, listener: BaseHermioneEvents[U]): this;
    emit<U extends keyof BaseHermioneEvents>(event: U, ...args: Parameters<BaseHermioneEvents[U]>): boolean;
    emitAndWait<U extends keyof BaseHermioneEvents>(event: U, ...args: Parameters<BaseHermioneEvents[U]>): Bluebird<void>;
}

abstract class BaseHermione extends events.AsyncEmitter {
    protected _interceptors: Array<Interceptor>;
    protected _config: Config;

    static create<T extends BaseHermione>(this: Constructor<T>, config: ConfigType | string): T {
        return new this(config);
    }

    constructor(config: ConfigType | string) {
        super();

        this._interceptors = [];

        this._config = Config.create(config);
        this._loadPlugins();
    }

    protected async _init(): Promise<void> {
        this._init = () => Bluebird.resolve(); // init only once
        return this.emitAndWait(RunnerEvents.INIT);
    }

    get config(): Config {
        return this._config;
    }

    public get events(): typeof RunnerEvents & typeof WorkerRunnerEvents {
        return _.extend({}, RunnerEvents, WorkerRunnerEvents);
    }

    public get errors(): typeof Errors {
        return Errors;
    }

    public intercept(event: string | symbol, handler: (...args: Array<any>) => any): this {
        this._interceptors.push({event, handler});

        return this;
    }

    public abstract isWorker(): boolean

    private _loadPlugins(): void {
        pluginsLoader.load(this, this.config.plugins, PREFIX);
    }
};

export default BaseHermione;
