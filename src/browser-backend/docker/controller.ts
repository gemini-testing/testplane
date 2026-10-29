import type { DockerConfig } from "../../config/types";

export interface DockerBrowserEntry {
    config: DockerConfig | null;
    browserName: string;
    browserVersion: string;
}

export interface DockerSession extends AsyncDisposable {
    readonly gridUrl: string;
    setSessionId(sessionId: string | null): void;
    extendCapabilities(capabilities: WebdriverIO.Capabilities): WebdriverIO.Capabilities;
    getLogs(): Promise<string>;
    saveLogs(sessionId: string): Promise<string>;
    prepareCdp(sessionId: string): Promise<boolean | void>;
}

/** The owner disposes the controller after all its sessions have finished. */
export interface DockerController extends AsyncDisposable {
    addBrowser(entry: DockerBrowserEntry): Promise<void>;
    allocateSession(version: string, timeout: number): DockerSession;
}
