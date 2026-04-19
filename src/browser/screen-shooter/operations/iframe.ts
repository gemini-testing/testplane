import type { ElementReference } from "@testplane/wdio-protocols";

export async function runInEachDisplayedIframe(
    session: WebdriverIO.Browser,
    cb: () => Promise<unknown> | unknown,
): Promise<void> {
    const iframes = await session.findElements("css selector", "iframe[src]");
    const displayedIframes: ElementReference[] = [];

    await Promise.all(
        iframes.map(async iframe => {
            const isIframeDisplayed = await session.$(iframe).isDisplayed();

            if (isIframeDisplayed) {
                displayedIframes.push(iframe);
            }
        }),
    );

    try {
        for (const iframe of displayedIframes) {
            await session.switchToFrame(iframe);
            await cb();
            // switchToParentFrame does not work in ios - https://github.com/appium/appium/issues/14882
            await session.switchToFrame(null);
        }
    } catch (e) {
        await session.switchToFrame(null);
        throw e;
    }
}
