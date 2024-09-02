import { Browser } from "../browser/browser";

export interface Pool<T extends Browser = Browser> {
    getBrowser(id: string, opts?: object): Promise<T>;
    freeBrowser(browser: T, opts?: object): Promise<void>;
    cancel(): void;
}

export interface BrowserOpts {
    force?: boolean;
    version?: string;
    highPriority?: boolean;
}
