export interface ClickCommandGuard {
    startClick: () => void;
    waitForNavigationCompletion: () => Promise<void>;
    cancelClick: () => void;
}

const activeGuards = new WeakMap<WebdriverIO.Browser, ClickCommandGuard>();
const guardedBrowsers = new WeakSet<WebdriverIO.Browser>();

/**
 * Install one persistent click wrapper because WebdriverIO commands cannot be restored after overwriteCommand.
 * The active guard can still be replaced or disabled when a browser session is reused.
 */
export const enableClickCommandGuard = (browser: WebdriverIO.Browser, guard: ClickCommandGuard): (() => void) => {
    activeGuards.set(browser, guard);

    if (!guardedBrowsers.has(browser)) {
        let guardedClickQueue = Promise.resolve();

        try {
            browser.overwriteCommand(
                "click",
                async function (this: WebdriverIO.Element, originalClick, options) {
                    const invocationGuard = activeGuards.get(browser);

                    if (!invocationGuard) {
                        return originalClick(options);
                    }

                    const guardedClickPromise = guardedClickQueue.then(async () => {
                        if (activeGuards.get(browser) !== invocationGuard) {
                            return;
                        }

                        invocationGuard.startClick();

                        try {
                            const result = await originalClick(options);

                            await invocationGuard.waitForNavigationCompletion();

                            return result;
                        } catch (err) {
                            invocationGuard.cancelClick();

                            throw err;
                        }
                    });

                    guardedClickQueue = guardedClickPromise.then(
                        () => undefined,
                        () => undefined,
                    );

                    return guardedClickPromise;
                },
                true,
            );
            guardedBrowsers.add(browser);
        } catch (err) {
            if (activeGuards.get(browser) === guard) {
                activeGuards.delete(browser);
            }

            throw err;
        }
    }

    return () => {
        if (activeGuards.get(browser) === guard) {
            guard.cancelClick();
            activeGuards.delete(browser);
        }
    };
};
