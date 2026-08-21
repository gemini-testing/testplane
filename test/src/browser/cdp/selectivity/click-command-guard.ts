import { enableClickCommandGuard } from "src/browser/cdp/selectivity/click-command-guard";

describe("CDP/Selectivity/click command guard", () => {
    it("should install the wrapper once and disable only the current guard", () => {
        let overwriteCommandCalls = 0;
        const browser = {
            overwriteCommand: (): void => {
                overwriteCommandCalls++;
            },
        } as unknown as WebdriverIO.Browser;
        let firstCancelClickCalls = 0;
        let secondCancelClickCalls = 0;
        const disableFirstGuard = enableClickCommandGuard(browser, {
            startClick: () => {},
            waitForNavigationCompletion: () => Promise.resolve(),
            cancelClick: () => firstCancelClickCalls++,
        });
        const disableSecondGuard = enableClickCommandGuard(browser, {
            startClick: () => {},
            waitForNavigationCompletion: () => Promise.resolve(),
            cancelClick: () => secondCancelClickCalls++,
        });

        disableFirstGuard();
        disableSecondGuard();

        assert.equal(overwriteCommandCalls, 1);
        assert.equal(firstCancelClickCalls, 0);
        assert.equal(secondCancelClickCalls, 1);
    });

    it("should not execute a queued click after the guard is disposed", async () => {
        let clickWrapper!: (
            originalClick: (options?: unknown) => Promise<unknown>,
            options?: unknown,
        ) => Promise<unknown>;
        const browser = {
            overwriteCommand: (_name: string, command: typeof clickWrapper): void => {
                clickWrapper = command;
            },
        } as unknown as WebdriverIO.Browser;
        let releaseFirstClick!: () => void;
        let markFirstClickStarted!: () => void;
        const firstClickRelease = new Promise<void>(resolve => (releaseFirstClick = resolve));
        const firstClickStarted = new Promise<void>(resolve => (markFirstClickStarted = resolve));
        let secondClickCalls = 0;
        const disableGuard = enableClickCommandGuard(browser, {
            startClick: () => {},
            waitForNavigationCompletion: () => Promise.resolve(),
            cancelClick: () => {},
        });

        const firstClick = clickWrapper(async () => {
            markFirstClickStarted();
            await firstClickRelease;
        });
        await firstClickStarted;

        const secondClick = clickWrapper(async () => {
            secondClickCalls++;
        });

        disableGuard();
        releaseFirstClick();
        await Promise.all([firstClick, secondClick]);

        assert.equal(secondClickCalls, 0);
    });
});
