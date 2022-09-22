import type NewBrowser from '../../browser/new-browser';

export type GetBrowserOpts = {
    version?: string;
    highPriority?: boolean;
};

export type FreeBrowserOpts = {
    force?: boolean;
    compositeIdForNextRequest?: string;
    hasFreeSlots?: boolean;
};

export interface Pool {
    getBrowser(id: string, opts?: GetBrowserOpts): Promise<NewBrowser>;
    freeBrowser(browser: NewBrowser, opts?: FreeBrowserOpts): Promise<void>;
    cancel(): void;
}

export type BrowserManager = {
    create: (id: string, version?: string) => NewBrowser;
    start: (browser: NewBrowser) => Promise<NewBrowser>;
    onStart: (browser: NewBrowser) => Promise<void>;
    onQuit: (browser: NewBrowser) => Promise<void>;
    quit: (browser: NewBrowser) => Promise<void>;
};
