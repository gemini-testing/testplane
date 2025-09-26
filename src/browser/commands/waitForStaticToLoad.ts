import type { Browser } from "../types";
import * as logger from "../../utils/logger";

/* eslint-disable no-var */
function browserIsPageReady(): { ready: boolean; reason?: string; pendingResources?: string[] } {
    if (document.readyState === "loading") {
        return { ready: false, reason: "Document is loading" };
    }

    if (document.currentScript) {
        return { ready: false, reason: "JavaScript is running" };
    }

    if (document.fonts && document.fonts.status === "loading") {
        return { ready: false, reason: "Fonts are loading" };
    }

    var imagesCount = (document.images && document.images.length) || 0;

    for (var i = 0; i < imagesCount; i++) {
        var image = document.images.item(i);

        if (image && !image.complete) {
            return { ready: false, reason: `Image from ${image.src} is loading` };
        }
    }

    var externalStyles = document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]');
    var externalStylesCount = (externalStyles && externalStyles.length) || 0;

    for (var i = 0; i < externalStylesCount; i++) {
        var style = externalStyles.item(i);

        if (!style.sheet) {
            return { ready: false, reason: `Styles from ${style.href} are loading` };
        }
    }

    var waitingForResourceUrls = new Set<string>();

    var nodesWithInlineStylesWithUrl = document.querySelectorAll<HTMLElement>('[style*="url("]');
    var styleWithUrlRegExp = /^url\("(.*)"\)$/;

    for (var node of nodesWithInlineStylesWithUrl) {
        if (!node.clientHeight || !node.clientWidth) {
            continue;
        }

        var inlineRulesCount = node.style ? node.style.length : 0;

        for (var i = 0; i < inlineRulesCount; i++) {
            var inlineRuleName = node.style[i];
            var inlineRuleValue = node.style[inlineRuleName as keyof CSSStyleDeclaration] as string;

            if (!inlineRuleValue || (!inlineRuleValue.startsWith('url("') && !inlineRuleValue.startsWith("url('"))) {
                continue;
            }

            var computedStyleValue = getComputedStyle(node).getPropertyValue(inlineRuleName);
            var match = styleWithUrlRegExp.exec(computedStyleValue);

            if (match && match[1] && !match[1].startsWith("data:")) {
                waitingForResourceUrls.add(match[1]);
            }
        }
    }

    for (var styleSheet of document.styleSheets) {
        try {
            for (var cssRules of styleSheet.cssRules) {
                var cssStyleRule = cssRules as CSSStyleRule;
                var cssStyleSelector = cssStyleRule.selectorText;
                var cssStyleRulesCount = cssStyleRule.style ? cssStyleRule.style.length : 0;

                var displayedNodeElementsStyles: CSSStyleDeclaration[] | null = null;

                for (var i = 0; i < cssStyleRulesCount; i++) {
                    var cssRuleName = cssStyleRule.style[i];
                    var cssRuleValue = cssStyleRule.style[cssRuleName as keyof CSSStyleDeclaration] as string;

                    if (!cssRuleValue || (!cssRuleValue.startsWith('url("') && !cssRuleValue.startsWith("url('"))) {
                        continue;
                    }

                    if (!displayedNodeElementsStyles) {
                        displayedNodeElementsStyles = [] as CSSStyleDeclaration[];

                        document.querySelectorAll<HTMLElement>(cssStyleSelector).forEach(function (node) {
                            if (!node.clientHeight || !node.clientWidth) {
                                return;
                            }

                            (displayedNodeElementsStyles as CSSStyleDeclaration[]).push(getComputedStyle(node));
                        });
                    }

                    for (var nodeStyles of displayedNodeElementsStyles) {
                        var computedStyleValue = nodeStyles.getPropertyValue(cssRuleName);
                        var match = styleWithUrlRegExp.exec(computedStyleValue);

                        if (match && match[1] && !match[1].startsWith("data:")) {
                            waitingForResourceUrls.add(match[1]);
                        }
                    }
                }
            }
        } catch (err) {} // eslint-disable-line no-empty
    }

    var performanceResourceEntries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];

    performanceResourceEntries.forEach(function (performanceResourceEntry) {
        waitingForResourceUrls.delete(performanceResourceEntry.name);
    });

    if (!waitingForResourceUrls.size) {
        return { ready: true };
    }

    var pendingResources = Array.from(waitingForResourceUrls);

    return { ready: false, reason: "Resources are not loaded", pendingResources };
}

function browserAreResourcesLoaded(pendingResources: string[]): string[] {
    var pendingResourcesSet = new Set(pendingResources);
    var performanceResourceEntries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];

    performanceResourceEntries.forEach(function (performanceResourceEntry) {
        pendingResourcesSet.delete(performanceResourceEntry.name);
    });

    return Array.from(pendingResourcesSet);
}
/* eslint-enable no-var */

export type WaitForStaticToLoadResult =
    | { ready: true }
    | { ready: false; reason: string }
    | { ready: false; reason: "Resources are not loaded"; pendingResources: string[] };

export default (browser: Browser): void => {
    const { publicAPI: session } = browser;

    session.addCommand(
        "waitForStaticToLoad",
        async function ({
            timeout = browser.config.waitTimeout,
            interval = browser.config.waitInterval,
        } = {}): Promise<WaitForStaticToLoadResult> {
            let isTimedOut = false;

            const loadTimeout = setTimeout(() => {
                isTimedOut = true;
            }, timeout).unref();
            const warnTimedOut = (result: ReturnType<typeof browserIsPageReady>): void => {
                const timedOutMsg = `Timed out waiting for page to load in ${timeout}ms.`;

                if (result && result.pendingResources) {
                    logger.warn(
                        [
                            `${timedOutMsg} Several resources are still not loaded:`,
                            ...result.pendingResources.map(resouce => `- ${resouce}`),
                        ].join("\n"),
                    );
                } else {
                    logger.warn(`${timedOutMsg} ${result.reason}`);
                }
            };

            let result = await session.execute(browserIsPageReady);

            while (!isTimedOut && !result.ready) {
                await new Promise(resolve => setTimeout(resolve, interval));

                if (result.pendingResources) {
                    result.pendingResources = await session.execute(browserAreResourcesLoaded, result.pendingResources);
                    result.ready = result.pendingResources.length === 0;
                } else {
                    result = await session.execute(browserIsPageReady);
                }
            }

            clearTimeout(loadTimeout);

            if (isTimedOut && !result.ready) {
                warnTimedOut(result);
            }

            if (result.ready) {
                return { ready: true };
            }

            if (result.reason === "Resources are not loaded") {
                return { ready: false, reason: "Resources are not loaded", pendingResources: result.pendingResources };
            }

            return { ready: false, reason: result.reason as string };
        },
    );
};
