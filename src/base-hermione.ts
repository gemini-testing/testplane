import _ from "lodash";
import pluginsLoader from "plugins-loader";
import { Config } from "./config/index.js";
import {
    AsyncEmitter,
    InterceptedEvent,
    MasterEvents,
    WorkerEvents,
    Events,
    InterceptHandler,
    Interceptor,
} from "./events/index.js";
import Errors from "./errors.js";
import { tryToRegisterTsNode } from "./utils/typescript.js";
import pkg from "../package.json" assert { type: "json" };
import type { ConfigInput } from "./config/types.js";

const PREFIX = pkg.name + "-";

export abstract class BaseHermione extends AsyncEmitter {
    protected _interceptors: Interceptor[] = [];
    protected _config: Config;

    static create<T extends BaseHermione>(
        this: new (config?: string | ConfigInput) => T,
        config?: string | ConfigInput,
    ): T {
        return new this(config);
    }

    protected constructor(config?: string | ConfigInput) {
        super();

        this._interceptors = [];

        tryToRegisterTsNode();

        console.log('INSIDE BASE HERM, config:', config);

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
        pluginsLoader.load(this, this.config.plugins, PREFIX);
    }
}
