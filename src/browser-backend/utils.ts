import type { BrowserConfig } from "../config/browser-config";
import { warn } from "../utils/logger";

/** Keep shutdown waiting until session startup and any rollback have finished. */
export function trackSessionStart(pending: Set<Promise<void>>): Disposable {
    let finish!: () => void;
    const completion = new Promise<void>(resolve => {
        finish = resolve;
    });
    pending.add(completion);
    return {
        [Symbol.dispose](): void {
            pending.delete(completion);
            finish();
        },
    };
}

export async function deleteWebdriverSession(session: WebdriverIO.Browser, config: BrowserConfig): Promise<boolean> {
    session.options.connectionRetryTimeout = config.sessionQuitTimeout ?? config.httpTimeout;
    try {
        await session.deleteSession();
        return true;
    } catch (error) {
        warn(`WARNING: Can not close session: ${(error as Error)?.message}`);
        return false;
    }
}
