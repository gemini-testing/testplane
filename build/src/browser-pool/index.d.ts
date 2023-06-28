import LimitedPool from "./limited-pool";
import PerBrowserLimitedPool from "./per-browser-limited-pool";
import { Config } from "../config";
import { AsyncEmitter } from "../events";
export type BrowserPool = LimitedPool | PerBrowserLimitedPool;
export declare const create: (config: Config, emitter: AsyncEmitter) => BrowserPool;
