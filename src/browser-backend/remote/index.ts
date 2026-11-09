import { remote } from "@testplane/webdriverio";
import type { BrowserBackend, BrowserBackendOptions } from "../index";
import type { BrowserConfig } from "../../config/browser-config";
import { AsyncCleanupStack } from "../../utils/async-cleanup-stack";
import { getWdioCreateSessionOpts } from "../../utils/session-opts";
import { deleteWebdriverSession, trackSessionStart } from "../utils";

export class RemoteBrowserBackend implements BrowserBackend {
    private readonly _sessions = new Map<
        WebdriverIO.Browser,
        { config: BrowserConfig; closing: Promise<void> | null }
    >();
    private readonly _pending = new Set<Promise<void>>();
    private _disposal: Promise<void> | null = null;

    constructor(private readonly _gridUrl: string) {}

    async startSession(config: BrowserConfig, options: BrowserBackendOptions = {}): Promise<WebdriverIO.Browser> {
        if (this._disposal) throw new Error("Browser backend is disposed");
        await using startup = new AsyncCleanupStack();
        startup.use(trackSessionStart(this._pending));
        const sessionOpts = getWdioCreateSessionOpts(this._gridUrl, config, options.browserVersionOverride);
        const session = await remote(sessionOpts);
        this._sessions.set(session, { config, closing: null });
        if (this._disposal) {
            await this.deleteSession(session);
            throw new Error("Browser backend is disposed");
        }
        return session;
    }

    deleteSession(session: WebdriverIO.Browser): Promise<void> {
        const entry = this._sessions.get(session);
        if (!entry) return Promise.resolve();
        entry.closing ??= deleteWebdriverSession(session, entry.config).then(() => {
            this._sessions.delete(session);
        });
        return entry.closing;
    }

    [Symbol.asyncDispose](): Promise<void> {
        return (this._disposal ??= this._dispose());
    }

    private async _dispose(): Promise<void> {
        await using cleanup = new AsyncCleanupStack();
        await Promise.allSettled(this._pending);
        for (const session of this._sessions.keys()) cleanup.defer(() => this.deleteSession(session));
    }
}
