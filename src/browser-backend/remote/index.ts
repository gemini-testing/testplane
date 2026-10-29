import type { BrowserBackendOptions } from "../index";
import type { BrowserConfig } from "../../config/browser-config";
import type { AsyncCleanupStack } from "../../utils/async-cleanup-stack";
import { getWdioCreateSessionOpts } from "../../utils/session-opts";
import { BaseBrowserBackend, type SessionInfo } from "../base";
import { connectSession, type SessionState } from "../session";

export class RemoteBrowserBackend extends BaseBrowserBackend {
    constructor(private readonly gridUrl: string) {
        super();
    }

    protected async startSession(
        config: BrowserConfig,
        options: BrowserBackendOptions,
        cleanup: AsyncCleanupStack,
        state: SessionState,
    ): Promise<SessionInfo> {
        const sessionOpts = getWdioCreateSessionOpts(this.gridUrl, config, options.browserVersionOverride);
        return { browser: await connectSession(sessionOpts, config, cleanup, state) };
    }
}
