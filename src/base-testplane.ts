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
import { registerReplModuleHooks } from "./utils/repl-module-hooks";
import { ConfigInput } from "./config/types";
import { ProfilerManager } from "./profiler/manager";
import { BootstrapProbe } from "./profiler/runtime/bootstrap-probe";
import { createProfilerEventObserver } from "./profiler/runtime/event-observer";
import type { ProcessRef } from "./profiler/schema";

interface ProfilerSetupOptions {
    runId?: string;
    process?: ProcessRef;
    /** Amount added to local wall-clock timestamps to align them with the main process. */
    clockOffsetMs?: number;
    /** Estimated maximum error of the supplied clock alignment. */
    clockUncertaintyMs?: number;
}

export abstract class BaseTestplane extends AsyncEmitter {
    protected _interceptors: Interceptor[] = [];
    protected _config!: Config;
    protected _initEventEmited: boolean = false;
    protected _bootstrapProbe!: BootstrapProbe;
    protected _profiler!: ProfilerManager;
    private _pendingConfig?: string | ConfigInput;
    private _pendingProfilerOptions?: ProfilerSetupOptions;

    static async create<T extends BaseTestplane>(
        this: new (config?: string | ConfigInput) => T,
        config?: string | ConfigInput,
        bootstrapProbe: BootstrapProbe = new BootstrapProbe(),
        profilerOptions: ProfilerSetupOptions = {},
    ): Promise<T> {
        const instance = new this(config);
        instance._bootstrapProbe = bootstrapProbe;
        instance._pendingProfilerOptions = profilerOptions;

        try {
            await instance._setup();
        } catch (error) {
            await instance._profiler?.finalizeSetupError(error);
            throw error;
        }

        return instance;
    }

    protected constructor(config?: string | ConfigInput) {
        super();

        this._interceptors = [];
        this._pendingConfig = config;
    }

    protected async _setup(): Promise<void> {
        const transformPhase = this._bootstrapProbe.startPhase("testplane.phase.transform-setup", "Set up transforms");
        try {
            registerReplModuleHooks();
            registerTransformHook(this.isWorker());
            transformPhase.end();
        } catch (error) {
            transformPhase.end("failed");
            throw error;
        }

        this._config = await Config.create(this._pendingConfig, this._bootstrapProbe);
        this._pendingConfig = undefined;
        this._profiler = new ProfilerManager(this._config, this._bootstrapProbe, {
            process:
                this._pendingProfilerOptions?.process ??
                ({
                    type: this.isWorker() ? "worker" : "master",
                    pid: process.pid,
                } as ProcessRef),
            runId: this._pendingProfilerOptions?.runId,
            clockOffsetMs: this._pendingProfilerOptions?.clockOffsetMs,
            clockUncertaintyMs: this._pendingProfilerOptions?.clockUncertaintyMs,
        });
        this._pendingProfilerOptions = undefined;
        this.setEventObserver(createProfilerEventObserver(this._profiler, this._config));

        this._profiler.runtime.withSpan("testplane.phase.plugins", { name: "Load plugins" }, () => {
            updateTransformHook(this._config);
            this._setLogLevel();
            this._loadPlugins();
        });
    }

    /** @note Only the first call returns a promise to wait for INIT handlers to complete, subsequent calls return immediately to avoid deadlocks */
    protected async _emitInitEventOnce(): Promise<void> {
        if (this._initEventEmited) {
            return;
        }

        this._initEventEmited = true;
        await this._profiler.runtime.withSpan("testplane.phase.init", { name: "Initialize Testplane" }, () =>
            this.emitAndWait(MasterEvents.INIT),
        );
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

    async profileCliCommand<T>(command: string, action: () => T | Promise<T>): Promise<T> {
        return this._profiler ? this._profiler.profileOperation(`cli:${command}`, action) : action();
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
