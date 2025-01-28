import debug from "debug";
import { NewBrowser } from "../browser/new-browser";
import { AsyncEmitter } from "../events";
import { BrowserOpts, Pool } from "./types";
import { Config } from "../config";
export declare class BasicPool implements Pool {
    private _config;
    private _emitter;
    private _activeSessions;
    private _cancelled;
    private _wdPool;
    log: debug.Debugger;
    static create(config: Config, emitter: AsyncEmitter): BasicPool;
    constructor(config: Config, emitter: AsyncEmitter);
    getBrowser(id: string, opts?: BrowserOpts): Promise<NewBrowser>;
    freeBrowser(browser: NewBrowser): Promise<void>;
    private _emit;
    cancel(): void;
}
