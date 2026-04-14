import makeDebug from "debug";
import { ClientBridge } from "../../client-bridge";
import type * as browserSideScreenshooterImplementation from "../../client-scripts/screen-shooter/implementation";
import { runWithoutHistory } from "../../history";
import type { WdioBrowser } from "../../../types";
import type { DisableHoverMode } from "../../isomorphic/types";

type BrowserSideScreenshooter = ClientBridge<typeof browserSideScreenshooterImplementation>;

const pointerDebug = makeDebug("testplane:screenshots:browser:pointer");

export async function cleanupPointerEvents(screenshooter: BrowserSideScreenshooter): Promise<void> {
    await screenshooter.call("cleanupPointerEvents", []);
}

export async function preparePointerForScreenshot(
    browser: WdioBrowser,
    opts: { disableHover?: DisableHoverMode; pointerEventsDisabled?: boolean },
): Promise<void> {
    if (!opts.disableHover || opts.disableHover === "never" || !opts.pointerEventsDisabled) {
        return;
    }

    return runWithoutHistory({}, async () => {
        if (!browser.isW3C) {
            pointerDebug("Skipping pointer move because session is not W3C");
        }

        try {
            pointerDebug("Trying to move pointer to reset hover states");
            await browser
                .action("pointer", { parameters: { pointerType: "mouse" } })
                .move({ duration: 0, origin: "viewport", x: 10, y: 10 })
                .pause(10)
                .move({ duration: 0, origin: "viewport", x: 0, y: 0 })
                .perform();
            pointerDebug("Pointer moved successfully");
        } catch (error) {
            pointerDebug("Failed to move pointer relatively: %O", error);
        }
    });
}
