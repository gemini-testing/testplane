import { remote } from "@testplane/webdriverio";
import type { Capabilities } from "@testplane/wdio-types";
import type { BrowserConfig } from "../config/browser-config";
import type { AsyncCleanupStack } from "../utils/async-cleanup-stack";
import { warn } from "../utils/logger";

export interface SessionState {
    force: boolean;
    deleted: boolean;
}

/** Register DELETE immediately, so later initialization failures cannot leak a session. */
export async function connectSession(
    options: Capabilities.WebdriverIOConfig,
    config: BrowserConfig,
    cleanup: AsyncCleanupStack,
    state: SessionState,
): Promise<WebdriverIO.Browser> {
    const browser = await remote(options);
    cleanup.defer(async () => {
        browser.options.connectionRetryTimeout = config.sessionQuitTimeout ?? config.httpTimeout;
        try {
            await browser.deleteSession();
            state.deleted = true;
        } catch (error) {
            state.force = true;
            warn(`WARNING: Can not close session: ${(error as Error).message}`);
        }
    });
    return browser;
}
