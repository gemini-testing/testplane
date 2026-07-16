import { setTimeout as nodeSetTimeout } from "node:timers";
import makeDebug from "debug";
import type { WdioBrowser } from "../../../types";
import type { ClientBridgeArgument } from "../../client-bridge";

const debug = makeDebug("testplane:screenshots:selectors-settle");
const SELECTORS_SETTLE_BROWSER_TIMEOUT_MS = 3000;
const SELECTORS_SETTLE_FALLBACK_INTERVAL_MS = 50;
const SELECTORS_SETTLE_FALLBACK_ATTEMPTS = 5;

type SelectorRect = { top: number; height: number } | null;
type ElementTarget = ClientBridgeArgument<string | Element>;

interface BrowserSelectorsSettleResult {
    success: boolean;
}

interface WaitForSelectorsToSettleOptions {
    needsCompatLib?: boolean;
}

export async function waitForSelectorsToSettle(
    browser: WdioBrowser,
    targets: ElementTarget[],
    options: WaitForSelectorsToSettleOptions = {},
): Promise<void> {
    try {
        const settleResult = await waitForSelectorsToSettleInBrowser(browser, targets, options);

        if (settleResult.success) {
            return;
        }

        debug("Browser-side waitForSelectorsToSettle cannot run, using Node-side polling");
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

    await waitForSelectorsToSettleInNode(browser, targets);
}

async function waitForSelectorsToSettleInBrowser(
    browser: WdioBrowser,
    targets: ElementTarget[],
    options: WaitForSelectorsToSettleOptions,
): Promise<BrowserSelectorsSettleResult> {
    if (options.needsCompatLib) {
        return { success: false };
    }

    const originalScriptTimeout =
        typeof browser.getTimeouts === "function" ? (await browser.getTimeouts())?.script : undefined;
    const shouldRestoreScriptTimeout = typeof originalScriptTimeout === "number";

    let executionError: unknown = null;
    let result: BrowserSelectorsSettleResult | undefined;

    if (shouldRestoreScriptTimeout) {
        await browser.setTimeout({ script: SELECTORS_SETTLE_BROWSER_TIMEOUT_MS });
    } else {
        debug("Browser does not report script timeout, running browser-side polling without timeout override");
    }

    try {
        result = await browser.execute(async (targets: ElementTarget[]) => {
            let setTimeoutSource = "";
            try {
                setTimeoutSource = typeof setTimeout === "function" ? Function.prototype.toString.call(setTimeout) : "";
            } catch {
                return { success: false };
            }

            if (!setTimeoutSource.includes("[native code]")) {
                return { success: false };
            }

            const PAGE_SETTLE_MAX_WAIT_MS = 50;
            const PAGE_SETTLE_MAX_ITERATIONS = 500;
            const PAGE_SETTLE_MATCHES_THRESHOLD = 3;
            const startedAt = performance.now();
            let iterations = 0;

            let matches = 0;

            const getBoundingClientRects = (): Array<DOMRect | null> =>
                targets.map(target => {
                    let element: Element | null;
                    if (typeof target !== "string") {
                        element = target as unknown as Element;
                    } else if (["/", "(", "../", "./", "*/"].some(start => target.indexOf(start) === 0)) {
                        element = document.evaluate(target, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
                            .singleNodeValue as Element | null;
                    } else {
                        element = document.querySelector(target);
                    }

                    return element ? element.getBoundingClientRect() : null;
                });

            let lastBoundingClientRects = getBoundingClientRects();
            while (
                performance.now() - startedAt < PAGE_SETTLE_MAX_WAIT_MS &&
                iterations < PAGE_SETTLE_MAX_ITERATIONS &&
                matches < PAGE_SETTLE_MATCHES_THRESHOLD
            ) {
                const currentBoundingClientRects = getBoundingClientRects();
                if (
                    currentBoundingClientRects.every((rect, index) => {
                        const lastRect = lastBoundingClientRects[index];

                        if (!rect || !lastRect) {
                            return rect === lastRect;
                        }

                        return rect.top === lastRect.top && rect.height === lastRect.height;
                    })
                ) {
                    matches++;
                } else {
                    matches = 0;
                }
                lastBoundingClientRects = currentBoundingClientRects;
                iterations++;
                await new Promise(resolve => setTimeout(resolve, 5));
            }

            return { success: true };
        }, targets);
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

    return result ?? { success: true };
}

async function waitForSelectorsToSettleInNode(browser: WdioBrowser, targets: ElementTarget[]): Promise<void> {
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
        const currentBoundingClientRects: SelectorRect[] = await browser.execute<SelectorRect[], [ElementTarget[]]>(
            function (targets) {
                return targets.map(function (target): SelectorRect {
                    let element: Element | null;
                    if (typeof target !== "string") {
                        element = target as unknown as Element;
                    } else if (
                        ["/", "(", "../", "./", "*/"].some(function (start) {
                            return target.indexOf(start) === 0;
                        })
                    ) {
                        element = document.evaluate(target, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
                            .singleNodeValue as Element | null;
                    } else {
                        element = document.querySelector(target);
                    }
                    const rect = element ? element.getBoundingClientRect() : null;

                    return rect ? { top: rect.top, height: rect.height } : null;
                });
            },
            targets,
        );

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
