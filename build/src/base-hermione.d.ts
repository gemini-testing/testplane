import { Config } from "./config";
import { AsyncEmitter, InterceptedEvent, Events, InterceptHandler, Interceptor } from "./events";
import Errors from "./errors";
import { ConfigInput } from "./config/types";
export declare abstract class BaseHermione extends AsyncEmitter {
    protected _interceptors: Interceptor[];
    protected _config: Config;
    static create<T extends BaseHermione>(this: new (config?: string | ConfigInput) => T, config?: string | ConfigInput): T;
    protected constructor(config?: string | ConfigInput);
    protected _init(): Promise<void>;
    get config(): Config;
    get events(): Events;
    get errors(): typeof Errors;
    intercept(event: InterceptedEvent, handler: InterceptHandler): this;
    abstract isWorker(): boolean;
    protected _loadPlugins(): void;
}
