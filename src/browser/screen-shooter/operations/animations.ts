import { ClientBridge } from "../../client-bridge";
import type * as browserSideScreenshooterImplementation from "../../client-scripts/screen-shooter/implementation";
import { isBrowserSideError } from "../../isomorphic/types";
import { runInEachDisplayedIframe } from "./iframe";
import type { WdioBrowser } from "../../../types";

type BrowserSideScreenshooter = ClientBridge<typeof browserSideScreenshooterImplementation>;

export async function disableIframeAnimations(
    browser: WdioBrowser,
    screenshooter: BrowserSideScreenshooter,
): Promise<void> {
    await runInEachDisplayedIframe(browser, async () => {
        const result = await screenshooter.call("disableFrameAnimations", []);

        if (isBrowserSideError(result)) {
            throw new Error(
                `Disable animations failed with error type '${result.errorCode}' and error message: ${result.message}`,
            );
        }
    });
}

export async function cleanupPageAnimations(
    browser: WdioBrowser,
    screenshooter: BrowserSideScreenshooter,
    isWebdriverProtocol: boolean,
): Promise<void> {
    await screenshooter.call("cleanupFrameAnimations", []);

    // https://github.com/webdriverio/webdriverio/issues/11396
    if (isWebdriverProtocol) {
        await runInEachDisplayedIframe(browser, async () => {
            await screenshooter.call("cleanupFrameAnimations", []);
        });
    }
}
