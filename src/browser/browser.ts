import crypto from "crypto";
import { RequestOptions } from "https";

import { RemoteCapability } from "@wdio/types/build/Capabilities";
import _ from "lodash";

import { SAVE_HISTORY_MODE } from "../constants/config";
import { X_REQUEST_ID_DELIMITER } from "../constants/browser";
import history from "./history";
import { enhanceStacktraces } from "./stacktrace";
import { getBrowserCommands, getElementCommands } from "./history/commands";
import addRunStepCommand from "./commands/runStep";
import { Config } from "../config";
import { AsyncEmitter } from "../events";
import { BrowserConfig } from "../config/browser-config";
import Callstack from "./history/callstack";
import type { WdProcess, WebdriverPool } from "../browser-pool/webdriver-pool";

const CUSTOM_SESSION_OPTS = [
    "outputDir",
    "agent",
    "headers",
    "transformRequest",
    "transformResponse",
    "strictSSL",
    // cloud service opts
    "user",
    "key",
    "region",
];

export type BrowserOpts = {
    id: string;
    version?: string;
    state?: Record<string, unknown>;
    emitter?: AsyncEmitter;
    wdPool?: WebdriverPool;
};

export type BrowserState = {
    testXReqId?: string;
    traceparent?: string;
    isBroken?: boolean;
};

export type CustomCommend = { name: string; elementScope: boolean };

export class Browser {
    protected _config: BrowserConfig;
    protected _debug: boolean;
    protected _session: WebdriverIO.Browser | null;
    protected _callstackHistory: Callstack | null;
    protected _state: BrowserState;
    protected _customCommands: Set<CustomCommend>;
    protected _wdPool?: WebdriverPool;
    protected _wdProcess: WdProcess | null;
    id: string;
    version?: string;

    static create<T extends Browser>(
        this: new (config: Config, opts: BrowserOpts) => T,
        config: Config,
        opts: BrowserOpts,
    ): T {
        return new this(config, opts);
    }

    constructor(config: Config, opts: BrowserOpts) {
        this.id = opts.id;
        this.version = opts.version;

        this._config = config.forBrowser(this.id);
        this._debug = config.system.debug;
        this._session = null;
        this._callstackHistory = null;
        this._wdProcess = null;
        this._state = {
            ...opts.state,
            isBroken: false,
        };
        this._customCommands = new Set();
        this._wdPool = opts.wdPool;
    }

    setHttpTimeout(timeout: number | null): void {
        if (timeout === null) {
            timeout = this._config.httpTimeout;
        }

        this._session!.extendOptions({ connectionRetryTimeout: timeout });
    }

    restoreHttpTimeout(): void {
        this.setHttpTimeout(this._config.httpTimeout);
    }

    applyState(state: Record<string, unknown>): void {
        _.extend(this._state, state);
    }

    protected _addCommands(): void {
        this._addExtendOptionsMethod(this._session!);
    }

    protected _addSteps(): void {
        addRunStepCommand(this);
    }

    protected _extendStacktrace(): void {
        enhanceStacktraces(this._session!);
    }

    protected _addHistory(): void {
        if (this._config.saveHistoryMode !== SAVE_HISTORY_MODE.NONE) {
            this._callstackHistory = history.initCommandHistory(this._session);
        }
    }

    protected _addExtendOptionsMethod(session: WebdriverIO.Browser): void {
        session.addCommand("extendOptions", opts => {
            _.extend(session.options, opts);
        });
    }

    protected _getSessionOptsFromConfig(optNames = CUSTOM_SESSION_OPTS): Record<string, unknown> {
        return optNames.reduce((options: Record<string, unknown>, optName) => {
            if (optName === "transformRequest") {
                options[optName] = (req: RequestOptions): RequestOptions => {
                    if (!_.isNull(this._config[optName])) {
                        req = this._config[optName](req);
                    }

                    if (!req.headers!["X-Request-ID"]) {
                        req.headers!["X-Request-ID"] = `${
                            this.state.testXReqId
                        }${X_REQUEST_ID_DELIMITER}${crypto.randomUUID()}`;
                    }
                    if (!req.headers!["traceparent"] && this.state.traceparent) {
                        req.headers!["traceparent"] = this.state.traceparent;
                    }

                    return req;
                };
            } else if (!_.isNull(this._config[optName as keyof BrowserConfig])) {
                options[optName] = this._config[optName as keyof BrowserConfig];
            }

            return options;
        }, {});
    }

    protected _startCollectingCustomCommands(): void {
        const browserCommands = getBrowserCommands();
        const elementCommands = getElementCommands();

        this._session!.overwriteCommand("addCommand", (origCommand, name, wrapper, elementScope, ...rest) => {
            const isKnownCommand = elementScope ? elementCommands.includes(name) : browserCommands.includes(name);

            if (!isKnownCommand) {
                this._customCommands.add({ name, elementScope: Boolean(elementScope) });
            }

            return origCommand(name, wrapper, elementScope, ...rest);
        });
    }

    get fullId(): string {
        return this.version ? `${this.id}.${this.version}` : this.id;
    }

    get publicAPI(): WebdriverIO.Browser {
        return this._session!; // exposing webdriver API as is
    }

    get sessionId(): string {
        return this.publicAPI.sessionId;
    }

    get config(): BrowserConfig {
        return this._config;
    }

    get state(): BrowserState {
        return this._state;
    }

    get capabilities(): RemoteCapability {
        return this.publicAPI.capabilities;
    }

    get callstackHistory(): Callstack {
        return this._callstackHistory!;
    }

    get customCommands(): CustomCommend[] {
        const allCustomCommands = Array.from(this._customCommands);
        return _.uniqWith(allCustomCommands, _.isEqual);
    }
}
