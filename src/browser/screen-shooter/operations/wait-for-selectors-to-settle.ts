import { setTimeout as nodeSetTimeout } from "node:timers";
import makeDebug from "debug";
import type { WdioBrowser } from "../../../types";

const debug = makeDebug("testplane:screenshots:selectors-settle");
const SELECTORS_SETTLE_BROWSER_TIMEOUT_MS = 3000;
const SELECTORS_SETTLE_FALLBACK_INTERVAL_MS = 50;
const SELECTORS_SETTLE_FALLBACK_ATTEMPTS = 5;

type SelectorRect = { top: number; height: number } | null;

interface BrowserSelectorsSettleResult {
    setTimeoutStubbed: boolean;
}

export async function waitForSelectorsToSettle(browser: WdioBrowser, selectors: string[]): Promise<void> {
    try {
        const settleResult = await waitForSelectorsToSettleInBrowser(browser, selectors);

        if (!settleResult.setTimeoutStubbed) {
            return;
        }

        debug("Browser-side waitForSelectorsToSettle detected stubbed setTimeout, using Node-side polling");
    } catch (err) {
        const scriptTimeoutError = err as { name?: string; message?: string; error?: string };
        const scriptTimeoutErrorText =
            err && typeof err === "object"
                ? [scriptTimeoutError.name, scriptTimeoutError.message, scriptTimeoutError.error].join(" ")
                : "";

        if (!/script timeout/i.test(scriptTimeoutErrorText)) {
            throw err;
        }

        debug("Browser-side waitForSelectorsToSettle hit script timeout, using Node-side polling");
    }

    await waitForSelectorsToSettleInNode(browser, selectors);
}

async function waitForSelectorsToSettleInBrowser(
    browser: WdioBrowser,
    selectors: string[],
): Promise<BrowserSelectorsSettleResult> {
    const originalTimeouts = await browser.getTimeouts();
    const originalScriptTimeout = originalTimeouts.script;
    const shouldRestoreScriptTimeout = typeof originalScriptTimeout === "number";

    let executionError: unknown = null;
    let result: BrowserSelectorsSettleResult | undefined;

    if (shouldRestoreScriptTimeout) {
        await browser.setTimeout({ script: SELECTORS_SETTLE_BROWSER_TIMEOUT_MS });
    } else {
        debug("Browser does not report script timeout, running browser-side polling without timeout override");
    }

    try {
        result = await browser.execute(async selectors => {
            let setTimeoutSource = "";
            try {
                setTimeoutSource = typeof setTimeout === "function" ? Function.prototype.toString.call(setTimeout) : "";
            } catch {
                return { setTimeoutStubbed: true };
            }

            if (!setTimeoutSource.includes("[native code]")) {
                return { setTimeoutStubbed: true };
            }

            const PAGE_SETTLE_MAX_WAIT_MS = 50;
            const PAGE_SETTLE_MAX_ITERATIONS = 500;
            const PAGE_SETTLE_MATCHES_THRESHOLD = 3;
            const startedAt = performance.now();
            let iterations = 0;

            let matches = 0;

            let lastBoundingClientRects = selectors.map(selector =>
                document.querySelector(selector)?.getBoundingClientRect(),
            );
            while (
                performance.now() - startedAt < PAGE_SETTLE_MAX_WAIT_MS &&
                iterations < PAGE_SETTLE_MAX_ITERATIONS &&
                matches < PAGE_SETTLE_MATCHES_THRESHOLD
            ) {
                const currentBoundingClientRects = selectors.map(selector =>
                    document.querySelector(selector)?.getBoundingClientRect(),
                );
                if (
                    currentBoundingClientRects.every(
                        (rect, index) =>
                            rect?.top === lastBoundingClientRects[index]?.top &&
                            rect?.height === lastBoundingClientRects[index]?.height,
                    )
                ) {
                    matches++;
                } else {
                    matches = 0;
                }
                lastBoundingClientRects = currentBoundingClientRects;
                iterations++;
                await new Promise(resolve => setTimeout(resolve, 5));
            }

            return { setTimeoutStubbed: false };
        }, selectors);
    } catch (err) {
        executionError = err;
    }

    if (shouldRestoreScriptTimeout) {
        try {
            await browser.setTimeout({ script: originalScriptTimeout });
        } catch (restoreError) {
            if (executionError) {
                debug(
                    "Failed to restore original script timeout after selectors settle error: %s",
                    restoreError instanceof Error ? restoreError.message : String(restoreError),
                );
            } else {
                throw restoreError;
            }
        }
    }

    if (executionError) {
        throw executionError;
    }

    return result ?? { setTimeoutStubbed: false };
}

async function waitForSelectorsToSettleInNode(browser: WdioBrowser, selectors: string[]): Promise<void> {
    const PAGE_SETTLE_MATCHES_THRESHOLD = 3;
    let matches = 0;
    let lastBoundingClientRects: SelectorRect[] | undefined;

    for (
        let attempt = 0;
        attempt <= SELECTORS_SETTLE_FALLBACK_ATTEMPTS && matches < PAGE_SETTLE_MATCHES_THRESHOLD;
        attempt++
    ) {
        if (lastBoundingClientRects) {
            await new Promise(resolve => {
                const timeoutId = nodeSetTimeout(resolve, SELECTORS_SETTLE_FALLBACK_INTERVAL_MS);
                timeoutId.unref();
            });
        }

        const previousBoundingClientRects = lastBoundingClientRects;
        const currentBoundingClientRects: SelectorRect[] = await browser.execute(selectors => {
            return selectors.map((selector): SelectorRect => {
                const rect = document.querySelector(selector)?.getBoundingClientRect();

                return rect ? { top: rect.top, height: rect.height } : null;
            });
        }, selectors);

        if (previousBoundingClientRects) {
            matches = currentBoundingClientRects.every((rect, index) => {
                const previousRect = previousBoundingClientRects[index];

                return rect?.top === previousRect?.top && rect?.height === previousRect?.height;
            })
                ? matches + 1
                : 0;
        }

        lastBoundingClientRects = currentBoundingClientRects;
    }
}
