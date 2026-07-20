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
            return { ready: false, reason: "Image from " + image.src + " is loading" };
        }
    }

    var externalStyles = document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]');
    var externalStylesCount = (externalStyles && externalStyles.length) || 0;

    for (var i = 0; i < externalStylesCount; i++) {
        var style = externalStyles.item(i);

        if (style && !style.sheet) {
            return { ready: false, reason: "Styles from " + style.href + " are loading" };
        }
    }

    var waitingForResourceUrls = Object.create(null) as Record<string, true>;

    var nodesWithInlineStylesWithUrl = document.querySelectorAll<HTMLElement>('[style*="url("]');
    var styleWithUrlRegExp = /^url\((?:"(.*)"|'(.*)')\)$/;

    for (var nodeIndex = 0; nodeIndex < nodesWithInlineStylesWithUrl.length; nodeIndex++) {
        var node = nodesWithInlineStylesWithUrl.item(nodeIndex);

        if (!node || !node.clientHeight || !node.clientWidth) {
            continue;
        }

        var inlineRulesCount = node.style ? node.style.length : 0;

        for (var i = 0; i < inlineRulesCount; i++) {
            var inlineRuleName = node.style.item(i);
            var inlineRuleValue = node.style[inlineRuleName as keyof CSSStyleDeclaration] as string;

            if (
                !inlineRuleValue ||
                (inlineRuleValue.indexOf('url("') !== 0 && inlineRuleValue.indexOf("url('") !== 0)
            ) {
                continue;
            }

            var computedStyleValue = getComputedStyle(node).getPropertyValue(inlineRuleName);
            var match = styleWithUrlRegExp.exec(computedStyleValue);
            var resourceUrl = match && (match[1] || match[2]);

            if (resourceUrl && resourceUrl.indexOf("data:") !== 0) {
                waitingForResourceUrls[resourceUrl] = true;
            }
        }
    }

    var styleSheetsCount = (document.styleSheets && document.styleSheets.length) || 0;

    for (var styleSheetIndex = 0; styleSheetIndex < styleSheetsCount; styleSheetIndex++) {
        var styleSheet = document.styleSheets.item(styleSheetIndex);

        if (!styleSheet) {
            continue;
        }

        try {
            var cssRules = styleSheet.cssRules;
            var cssRulesCount = (cssRules && cssRules.length) || 0;

            for (var cssRuleIndex = 0; cssRuleIndex < cssRulesCount; cssRuleIndex++) {
                var cssStyleRule = cssRules.item(cssRuleIndex) as CSSStyleRule;
                var cssStyleSelector = cssStyleRule.selectorText;
                var cssStyleRulesCount = cssStyleRule.style ? cssStyleRule.style.length : 0;

                var displayedNodeElementsStyles: CSSStyleDeclaration[] | null = null;

                for (var i = 0; i < cssStyleRulesCount; i++) {
                    var cssRuleName = cssStyleRule.style.item(i);
                    var cssRuleValue = cssStyleRule.style[cssRuleName as keyof CSSStyleDeclaration] as string;

                    if (!cssRuleValue || (cssRuleValue.indexOf('url("') !== 0 && cssRuleValue.indexOf("url('") !== 0)) {
                        continue;
                    }

                    if (!displayedNodeElementsStyles) {
                        displayedNodeElementsStyles = [] as CSSStyleDeclaration[];
                        var matchingNodes = document.querySelectorAll<HTMLElement>(cssStyleSelector);

                        for (var matchingNodeIndex = 0; matchingNodeIndex < matchingNodes.length; matchingNodeIndex++) {
                            var matchingNode = matchingNodes.item(matchingNodeIndex);

                            if (!matchingNode || !matchingNode.clientHeight || !matchingNode.clientWidth) {
                                continue;
                            }

                            displayedNodeElementsStyles.push(getComputedStyle(matchingNode));
                        }
                    }

                    for (
                        var nodeStylesIndex = 0;
                        nodeStylesIndex < displayedNodeElementsStyles.length;
                        nodeStylesIndex++
                    ) {
                        var nodeStyles = displayedNodeElementsStyles[nodeStylesIndex];
                        var computedStyleValue = nodeStyles.getPropertyValue(cssRuleName);
                        var match = styleWithUrlRegExp.exec(computedStyleValue);
                        var resourceUrl = match && (match[1] || match[2]);

                        if (resourceUrl && resourceUrl.indexOf("data:") !== 0) {
                            waitingForResourceUrls[resourceUrl] = true;
                        }
                    }
                }
            }
        } catch (err) {} // eslint-disable-line no-empty
    }

    var performanceResourceEntries =
        window.performance && typeof window.performance.getEntriesByType === "function"
            ? (window.performance.getEntriesByType("resource") as PerformanceResourceTiming[])
            : [];

    performanceResourceEntries.forEach(function (performanceResourceEntry) {
        delete waitingForResourceUrls[performanceResourceEntry.name];
    });

    var pendingResources = Object.keys(waitingForResourceUrls);

    if (!pendingResources.length) {
        return { ready: true };
    }

    return { ready: false, reason: "Resources are not loaded", pendingResources: pendingResources };
}

function browserAreResourcesLoaded(pendingResources: string[]): string[] {
    var pendingResourcesMap = Object.create(null) as Record<string, true>;

    for (var i = 0; i < pendingResources.length; i++) {
        pendingResourcesMap[pendingResources[i]] = true;
    }

    var performanceResourceEntries =
        window.performance && typeof window.performance.getEntriesByType === "function"
            ? (window.performance.getEntriesByType("resource") as PerformanceResourceTiming[])
            : [];

    performanceResourceEntries.forEach(function (performanceResourceEntry) {
        delete pendingResourcesMap[performanceResourceEntry.name];
    });

    return Object.keys(pendingResourcesMap);
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
