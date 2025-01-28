import { Config } from "../config";
import { AsyncEmitter } from "../events";
import { BrowserConfig } from "../config/browser-config";
import Callstack from "./history/callstack";
import type { WdProcess, WebdriverPool } from "../browser-pool/webdriver-pool";
import type { Capabilities } from "@wdio/types";
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
export type CustomCommend = {
    name: string;
    elementScope: boolean;
};
export declare class Browser {
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
    static create<T extends Browser>(this: new (config: Config, opts: BrowserOpts) => T, config: Config, opts: BrowserOpts): T;
    constructor(config: Config, opts: BrowserOpts);
    setHttpTimeout(timeout: number | null): void;
    restoreHttpTimeout(): void;
    applyState(state: Record<string, unknown>): void;
    protected _addCommands(): void;
    protected _addSteps(): void;
    protected _extendStacktrace(): void;
    protected _addHistory(): void;
    protected _addExtendOptionsMethod(session: WebdriverIO.Browser): void;
    protected _getSessionOptsFromConfig(optNames?: string[]): Record<string, unknown>;
    protected _startCollectingCustomCommands(): void;
    get fullId(): string;
    get publicAPI(): WebdriverIO.Browser;
    get sessionId(): string;
    get config(): BrowserConfig;
    get state(): BrowserState;
    get capabilities(): Capabilities.RemoteCapability;
    get callstackHistory(): Callstack;
    get customCommands(): CustomCommend[];
}
