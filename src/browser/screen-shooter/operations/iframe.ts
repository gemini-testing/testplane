import type { ElementReference } from "@testplane/wdio-protocols";
import { loadEsm } from "../../../utils/preload-utils";
import { warn } from "../../../utils/logger";

type VisibilityScript = (element: ElementReference) => boolean;

export async function runInEachDisplayedIframe(
    session: WebdriverIO.Browser,
    cb: () => Promise<unknown> | unknown,
): Promise<void> {
    const { default: isElementDisplayed } = await loadEsm<{ default: VisibilityScript }>(
        "@testplane/webdriverio/scripts/isElementDisplayed.js",
    );
    const iframes = await session.findElements("css selector", "iframe[src]");

    for (const iframe of iframes) {
        try {
            // Raw element references have no selector for WDIO to refetch if the iframe disappears.
            if (!(await session.execute(isElementDisplayed, iframe))) {
                continue;
            }
            await session.switchToFrame(iframe);
        } catch (error) {
            const errorCode = (error as { error?: string; name?: string }).error ?? (error as Error).name;
            if (errorCode !== "stale element reference" && errorCode !== "no such frame") {
                throw error;
            }
            warn("Skipping an iframe that disappeared before screenshot preparation", { iframe, errorCode });
            await session.switchToFrame(null);
            continue;
        }

        try {
            await cb();
        } finally {
            // switchToParentFrame does not work in ios - https://github.com/appium/appium/issues/14882
            await session.switchToFrame(null);
        }
    }
}
