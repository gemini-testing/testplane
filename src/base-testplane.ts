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
import { tryToRegisterTsNode } from "./utils/typescript";
import { ConfigInput } from "./config/types";

export abstract class BaseTestplane extends AsyncEmitter {
    protected _interceptors: Interceptor[] = [];
    protected _config: Config;

    static create<T extends BaseTestplane>(
        this: new (config?: string | ConfigInput) => T,
        config?: string | ConfigInput,
    ): T {
        return new this(config);
    }

    protected constructor(config?: string | ConfigInput) {
        super();

        this._interceptors = [];

        tryToRegisterTsNode(this.isWorker());

        this._config = Config.create(config);
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
