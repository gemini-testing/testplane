import _ from "lodash";
import pluginsLoader from "plugins-loader";
import { Config } from "./config";
import {
    AsyncEmitter,
    InterceptedEvent,
    MasterEvents,
    WorkerEvents,
    Events,
    InterceptHandler,
    Interceptor,
} from "./events";
import Errors from "./errors";
import { registerTransformHook, updateTransformHook } from "./utils/typescript";
import { ConfigInput } from "./config/types";

export abstract class BaseTestplane extends AsyncEmitter {
    protected _interceptors: Interceptor[] = [];
    protected _config!: Config;
    private _pendingConfig?: string | ConfigInput;

    static async create<T extends BaseTestplane>(
        this: new (config?: string | ConfigInput) => T,
        config?: string | ConfigInput,
    ): Promise<T> {
        const instance = new this(config);

        await instance._setup();

        return instance;
    }

    protected constructor(config?: string | ConfigInput) {
        super();

        this._interceptors = [];
        this._pendingConfig = config;
    }

    protected async _setup(): Promise<void> {
        registerTransformHook(this.isWorker());
        this._config = await Config.create(this._pendingConfig);
        this._pendingConfig = undefined;
        updateTransformHook(this._config);

        this._setLogLevel();
        this._loadPlugins();
    }

    protected async _init(): Promise<void> {
        this._init = (): Promise<void> => Promise.resolve(); // init only once
        await this.emitAndWait(MasterEvents.INIT);
    }

    get config(): Config {
        return this._config;
    }

    get events(): Events {
        return _.extend({}, MasterEvents, WorkerEvents);
    }

    get errors(): typeof Errors {
        return Errors;
    }

    intercept(event: InterceptedEvent, handler: InterceptHandler): this {
        this._interceptors.push({ event, handler });

        return this;
    }

    abstract isWorker(): boolean;

    protected _setLogLevel(): void {
        if (!process.env.WDIO_LOG_LEVEL) {
            process.env.WDIO_LOG_LEVEL = _.get(this.config, "system.debug", false) ? "trace" : "error";
        }
    }

    protected _loadPlugins(): void {
        pluginsLoader.load(this, this.config.plugins, "hermione-");
    }
}
