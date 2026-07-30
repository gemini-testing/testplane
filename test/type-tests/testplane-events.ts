import type Testplane from "../../src";

export const registerNewBrowserHandler = (testplane: Testplane): void => {
    if (testplane.isWorker()) {
        testplane.on(testplane.events.NEW_BROWSER, async (browser, { browserId, browserVersion }) => {
            void browser;
            void browserId;
            void browserVersion;
        });
    }
};

export const registerNewBrowserHandlerWithoutWorkerGuard = (testplane: Testplane): void => {
    // @ts-expect-error NEW_BROWSER is only available in worker context
    testplane.on(testplane.events.NEW_BROWSER, () => {});
};
