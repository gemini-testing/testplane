import { Browser } from "../browser/browser";

export interface Pool<T extends Browser = Browser> {
    getBrowser(id: string, opts?: object): Promise<T>;
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
