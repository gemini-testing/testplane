import { Point, Rect } from "../../image";
import { WdioBrowser } from "../../types";

export async function getBoundingRects(browser: WdioBrowser, selectors: string[]): Promise<Rect[]> {
    return browser.execute((selectors: string[]) => {
        /* eslint-disable no-var */
        // @ts-expect-error Can't use TypeScript in browser-side code
        var boundingRects = [];

        selectors.forEach(function (selector) {
            var element = document.querySelector(selector);

            if (!element) {
                throw new Error(`Element with selector ${selector} not found`);
            }

            var rect = element.getBoundingClientRect();
            boundingRects.push({
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
            });
        });
        // @ts-expect-error Can't use TypeScript in browser-side code
        return boundingRects;
        /* eslint-enable no-var */
    }, selectors);
}

interface ScrollByParams {
    x: number;
    y: number;
    selectorToScroll?: string;
    // Used to auto-detect scroll parent if selectorToScroll is not provided
    selectorsToCapture: string[];
    debug?: boolean;
}

interface ScrollByResult {
    viewportOffset: Point;
    scrollElementOffset: Point;
    // Used for human-readable errors
    readableSelectorToScrollDescr: string;
    debugLog?: string;
}

export async function findScrollParentAndScrollBy(
    browser: WdioBrowser,
    params: ScrollByParams,
): Promise<ScrollByResult> {
    return browser.execute(function (params) {
        /* eslint-disable no-var */
        /* eslint-disable @typescript-eslint/explicit-function-return-type */
        /* eslint-disable prefer-rest-params */
        // @ts-expect-error Can't use TypeScript in browser-side code
        function createDebugLogger(opts) {
            var log = "";
            if (opts.debug) {
                // @ts-expect-error Can't use TypeScript in browser-side code
                return function (...args) {
                    // eslint-disable-line @typescript-eslint/no-unused-vars
                    for (var i = 0; i < arguments.length; i++) {
                        if (typeof arguments[i] === "object") {
                            try {
                                log += JSON.stringify(arguments[i], null, 2) + "\n";
                            } catch (e) {
                                log += "<failed log message due to an error: " + e;
                            }
                        } else {
                            log += arguments[i] + "\n";
                        }
                    }

                    return log;
                };
            }

            return function () {
                return "";
            };
        }
        // @ts-expect-error Can't use TypeScript in browser-side code
        function getScrollOffset(element) {
            if (element === window) {
                return { top: window.pageYOffset, left: window.pageXOffset };
            }
            return { top: element.scrollTop, left: element.scrollLeft };
        }

        // @ts-expect-error Can't use TypeScript in browser-side code
        function getClientSize(element) {
            if (element === window) {
                return { height: window.innerHeight, width: window.innerWidth };
            }
            return { height: element.clientHeight, width: element.clientWidth };
        }

        // @ts-expect-error Can't use TypeScript in browser-side code
        function getScrollSize(element) {
            if (element === window) {
                return { height: window.document.body.scrollHeight, width: window.document.body.scrollWidth };
            }
            return { height: element.scrollHeight, width: element.scrollWidth };
        }

        var logger = createDebugLogger(params);

        // @ts-expect-error Can't use TypeScript in browser-side code
        function getParentNode(node) {
            if (!node) return null;
            if (node instanceof ShadowRoot) return node.host;
            if (node instanceof Element) {
                const root = node.getRootNode();
                return node.parentElement || (root instanceof ShadowRoot ? root.host : null);
            }
            return node.parentNode; // for Text/Comment nodes
        }

        // @ts-expect-error Can't use TypeScript in browser-side code
        function getScrollParent(element) {
            if (element === null) {
                return null;
            }

            if (element === window) {
                return window;
            }

            var hasOverflow = element.scrollHeight > element.clientHeight;
            if (element instanceof Element) {
                var computedStyleOverflowY = window.getComputedStyle(element).overflowY;
            } else {
                return getScrollParent(getParentNode(element));
            }

            var canBeScrolled =
                computedStyleOverflowY === "auto" ||
                computedStyleOverflowY === "scroll" ||
                computedStyleOverflowY === "overlay";

            if (hasOverflow && canBeScrolled) {
                if (element.tagName === "BODY") {
                    return window;
                }

                return element;
            } else {
                return getScrollParent(getParentNode(element));
            }
        }

        // @ts-expect-error Can't use TypeScript in browser-side code
        function getResultScrollOffsets(element) {
            logger("getting result scroll offsets. element: ", element);
            if (element === window || element.tagName === "HTML") {
                logger("element is window. resulting window scroll offsets: ", {
                    top: window.pageYOffset,
                    left: window.pageXOffset,
                });

                return {
                    readableSelectorToScrollDescr: "window",
                    viewportOffset: { top: window.pageYOffset, left: window.pageXOffset },
                    scrollElementOffset: { top: 0, left: 0 },
                    debugLog: logger(),
                };
            }

            var viewportOffset = { top: window.pageYOffset, left: window.pageXOffset };
            var scrollElementOffset = { top: element.scrollTop, left: element.scrollLeft };

            logger("element is not window. returning combo of window and container: ", {
                viewportOffset,
                scrollElementOffset,
            });

            return {
                readableSelectorToScrollDescr: `<${element.tagName.toLowerCase()} class="${element.classList.toString()} ${
                    element.id ? `id="${element.id}"` : ""
                }>...`,
                viewportOffset,
                scrollElementOffset,
                debugLog: logger(),
            };
        }

        var elementToScroll, targetScrollOffset, originalScrollOffset, iterations;

        if (params.selectorToScroll) {
            elementToScroll = document.querySelector(params.selectorToScroll);

            if (!elementToScroll) {
                throw new Error(
                    "Scrolling screenshot failed with: " +
                        'Could not find element with css selector specified in "selectorToScroll" option: ' +
                        params.selectorToScroll,
                );
            }
        } else {
            var scrollParents = params.selectorsToCapture.map(function (selector) {
                return getScrollParent(document.querySelector(selector));
            });

            if (
                scrollParents[0] !== null &&
                scrollParents.every(function (element) {
                    return scrollParents[0] === element;
                })
            ) {
                elementToScroll = scrollParents[0];
            } else {
                elementToScroll = window;
            }
        }

        originalScrollOffset = getScrollOffset(elementToScroll);
        targetScrollOffset = { top: originalScrollOffset.top + params.y, left: originalScrollOffset.left + params.x };

        logger("original scroll offset:", originalScrollOffset);
        logger(
            "performing scroll in element to coords:",
            elementToScroll,
            targetScrollOffset.top,
            targetScrollOffset.left,
        );

        elementToScroll.scrollTo(targetScrollOffset.left, targetScrollOffset.top);

        // Wait for scroll to happen
        iterations = 0;
        var resultScrollOffset = getScrollOffset(elementToScroll),
            clientSize = getClientSize(elementToScroll),
            scrollSize = getScrollSize(elementToScroll);
        const reachedVerticalScrollLimit =
            params.y === 0 || resultScrollOffset.top + clientSize.height >= scrollSize.height;
        const reachedHorizontalScrollLimit =
            params.x === 0 || resultScrollOffset.left + clientSize.width >= scrollSize.width;

        while (
            resultScrollOffset.left === originalScrollOffset.left &&
            resultScrollOffset.top === originalScrollOffset.top &&
            !(reachedVerticalScrollLimit && reachedHorizontalScrollLimit)
        ) {
            if (iterations++ > 100000) {
                return getResultScrollOffsets(elementToScroll);
            }
            resultScrollOffset = getScrollOffset(elementToScroll);
        }

        return getResultScrollOffsets(elementToScroll);
        /* eslint-enable @typescript-eslint/explicit-function-return-type */
        /* eslint-enable prefer-rest-params */
        /* eslint-enable no-var */
    }, params);
}
