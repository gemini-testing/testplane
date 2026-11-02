import { Browser } from "../browser/browser";
import { BrowserConfig } from "../config/browser-config";

export interface Pool<T extends Browser = Browser> extends AsyncDisposable {
    [Symbol.asyncDispose](): Promise<void>;
    prewarm(browserConfigs: BrowserConfig[]): Promise<void>;
    getBrowser(browserConfig: BrowserConfig, opts?: object): Promise<T>;
    freeBrowser(browser: T, opts?: object): Promise<void>;
    cancel(error?: Error): void;
}

export interface BrowserOpts {
    force?: boolean;
    version?: string;
    highPriority?: boolean;
}

export type PoolLimiterKind = "browser" | "global";

export interface PoolObserverOperation {
    end(status?: "completed" | "failed" | "interrupted"): void;
}

export interface PoolObserver {
    start(kind: string, data: Record<string, string | number | boolean | null>): PoolObserverOperation;
    record(event: string, data: Record<string, string | number | boolean | null>): void;
}
