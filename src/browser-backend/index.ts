import type { BrowserConfig } from "../config/browser-config";

export interface BrowserBackendOptions {
    browserVersionOverride?: string | null;
}

export interface SessionCloseOptions {
    force?: boolean;
}

export interface BrowserSession extends AsyncDisposable {
    readonly browser: WebdriverIO.Browser;
    readonly driverPid: number | null;
    readonly cdpAvailable: boolean | null;
    close(options?: SessionCloseOptions): Promise<void>;
}

export interface BrowserBackendClient {
    createSession(config: BrowserConfig, options?: BrowserBackendOptions): Promise<BrowserSession>;
    deleteSession(session: BrowserSession, options?: SessionCloseOptions): Promise<void>;
}

export interface BrowserBackend extends BrowserBackendClient, AsyncDisposable {}
