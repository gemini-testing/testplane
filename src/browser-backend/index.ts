import type { BrowserConfig } from "../config/browser-config";

export interface BrowserBackendOptions {
    browserVersionOverride?: string | null;
}

export interface SessionCloseOptions {
    force?: boolean;
}

export interface BrowserBackendClient {
    startSession(config: BrowserConfig, options?: BrowserBackendOptions): Promise<WebdriverIO.Browser>;
    deleteSession(session: WebdriverIO.Browser, options?: SessionCloseOptions): Promise<void>;
    getDriverPid?(session: WebdriverIO.Browser): number | null;
    isCdpAvailable?(session: WebdriverIO.Browser): boolean;
}

export interface BrowserBackend extends BrowserBackendClient, AsyncDisposable {}
