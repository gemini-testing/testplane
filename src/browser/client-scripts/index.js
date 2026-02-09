/*jshint browserify:true*/
"use strict";

var util = require("./util"),
    rect = require("./rect"),
    lib = require("./lib"),
    queryIgnoreAreas = require("./ignore-areas"),
    Rect = rect.Rect;

if (typeof window === "undefined") {
    global.__geminiCore = exports;
} else {
    window.__geminiCore = exports;
}

exports.queryFirst = lib.queryFirst;

exports.prepareScreenshot = function prepareScreenshot(areas, opts) {
    opts = opts || {};
    try {
        return prepareScreenshotUnsafe(areas, opts);
    } catch (e) {
        return {
            errorCode: "JS",
            message: e.stack || e.message
        };
    }
};

exports.disableFrameAnimations = function disableFrameAnimations() {
    try {
        return disableFrameAnimationsUnsafe();
    } catch (e) {
        return {
            errorCode: "JS",
            message: e.stack || e.message
        };
    }
};

exports.cleanupFrameAnimations = function cleanupFrameAnimations() {
    if (window.__cleanupAnimation) {
        window.__cleanupAnimation();
    }
};

exports.disablePointerEvents = function disablePointerEvents() {
    try {
        return disablePointerEventsUnsafe();
    } catch (e) {
        return {
            errorCode: "JS",
            message: e.stack || e.message
        };
    }
};

exports.cleanupPointerEvents = function cleanupPointerEvents() {};

function prepareScreenshotUnsafe(areas, opts) {
    var logger = util.createDebugLogger(opts);

    var allowViewportOverflow = opts.allowViewportOverflow;
    var captureElementFromTop = opts.captureElementFromTop;
    var disableAnimation = opts.disableAnimation;
    var scrollElem = window;

    var mainDocumentElem = util.getMainDocumentElem(),
        viewportWidth = mainDocumentElem.clientWidth,
        viewportHeight = mainDocumentElem.clientHeight,
        documentWidth = mainDocumentElem.scrollWidth,
        documentHeight = mainDocumentElem.scrollHeight,
        viewPort = new Rect({
            left: util.getScrollLeft(scrollElem),
            top: util.getScrollTop(scrollElem),
            width: viewportWidth,
            height: viewportHeight
        }),
        pixelRatio = configurePixelRatio(opts.usePixelRatio),
        rect,
        selectors = [];

    logger("prepareScreenshotUnsafe, viewport size at the start:", viewPort);

    areas.forEach(function (area) {
        if (Rect.isRect(area)) {
            rect = rect ? rect.merge(new Rect(area)) : new Rect(area);
        } else {
            selectors.push(area);
        }
    });

    var captureElements = getCaptureElements(selectors);

    if (opts.selectorToScroll) {
        scrollElem = document.querySelector(opts.selectorToScroll);

        if (!scrollElem) {
            return {
                errorCode: "NOTFOUND",
                message:
                    'Could not find element with css selector specified in "selectorToScroll" option: ' +
                    opts.selectorToScroll,
                selector: opts.selectorToScroll,
                debugLog: logger()
            };
        }
    } else {
        // Try to determine scroll element automatically or fallback to window
        var scrollParents = captureElements.map(function (element) {
            return util.getScrollParent(element, logger);
        });

        if (
            scrollParents[0] &&
            scrollParents.every(function (element) {
                return scrollParents[0] === element;
            })
        ) {
            scrollElem = scrollParents[0];
        }
    }

    rect = getCaptureRect(
        captureElements,
        {
            allowViewportOverflow: allowViewportOverflow,
            scrollElem: scrollElem,
            viewportWidth: viewportWidth,
            documentHeight: documentHeight
        },
        logger
    );
    logger("getCaptureRect, resulting rect:", rect);

    if (!rect) {
        return {
            errorCode: "HIDDEN",
            message: "Area with css selector : " + selectors + " is hidden",
            selector: selectors,
            debugLog: logger()
        };
    }

    if (rect.error) {
        return rect;
    }

    var ignoreAreas = findIgnoreAreas(
        opts.ignoreSelectors,
        {
            scrollElem: scrollElem,
            pixelRatio: pixelRatio,
            viewportWidth: viewportWidth,
            documentHeight: documentHeight
        },
        logger
    );

    var safeArea = getSafeAreaRect(
        rect,
        captureElements,
        {
            scrollElem: scrollElem,
            viewportWidth: viewportWidth,
            viewportHeight: viewportHeight
        },
        logger
    );

    var topmostCaptureElementTop = captureElements.reduce(function (top, currentElement) {
        var currentElementTop = currentElement.getBoundingClientRect().top;
        if (currentElementTop < top) {
            return currentElementTop;
        }

        return top;
    }, 9999999);

    var scrollOffsetTopForFit = scrollElem === window || !scrollElem.parentElement ? 0 : util.getScrollTop(scrollElem);
    var rectTopInViewportForFit = rect.top - scrollOffsetTopForFit - window.scrollY;
    var rectBottomInViewportForFit = rectTopInViewportForFit + rect.height;
    var fitsInSafeArea =
        rectTopInViewportForFit >= safeArea.top && rectBottomInViewportForFit <= safeArea.top + safeArea.height;

    if (captureElementFromTop && !fitsInSafeArea) {
        logger("captureElementFromTop=true and capture element is outside of viewport, going to perform scroll");
        if (!util.isRootElement(scrollElem) && captureElementFromTop) {
            var scrollElemBoundingRect = getBoundingClientContentRect(scrollElem);
            var targetWindowScrollY = Math.floor(scrollElemBoundingRect.top - safeArea.top);

            logger(
                "  performing window.scrollTo to scroll to scrollElement, coords: " +
                    window.scrollX +
                    ", " +
                    targetWindowScrollY
            );
            window.scrollTo(window.scrollX, targetWindowScrollY);

            rect = getCaptureRect(
                captureElements,
                {
                    allowViewportOverflow: allowViewportOverflow,
                    scrollElem: scrollElem,
                    viewportWidth: viewportWidth,
                    documentHeight: documentHeight
                },
                logger
            );

            ignoreAreas = findIgnoreAreas(
                opts.ignoreSelectors,
                {
                    scrollElem: scrollElem,
                    pixelRatio: pixelRatio,
                    viewportWidth: viewportWidth,
                    documentHeight: documentHeight
                },
                logger
            );

            safeArea = getSafeAreaRect(
                rect,
                captureElements,
                {
                    scrollElem: scrollElem,
                    viewportWidth: viewportWidth,
                    viewportHeight: viewportHeight
                },
                logger
            );
        }
        logger("  capture rect before scrolling to capture area:", rect);

        // If we are scrolling window, we just need to scroll to element, taking safeArea into account.
        // If we are scrolling inside some container, we should take both safe area and existing window scroll offset into account.
        // Example: We have container at 1000px and target block inside it at 2000px (measured in global page coords).
        //          In the code above we scrolled window by 1000px to container.
        //          So now we only need to scroll by 1000px inside that container to our block, not by 2000px, because we already scrolled window by 1000px.
        var targetScrollY = Math.max(
            Math.floor(rect.top - (util.isRootElement(scrollElem) ? safeArea.top : safeArea.top + window.scrollY)),
            0
        );
        var targetScrollX = util.isRootElement(scrollElem) ? window.scrollX : scrollElem.scrollLeft;

        logger("  performing scroll to capture area, coords: " + targetScrollY + ", " + targetScrollX);

        if (util.isSafariMobile()) {
            scrollToCaptureAreaInSafari(
                viewPort,
                new Rect({ left: rect.left, top: targetScrollY, width: rect.width, height: rect.height }),
                scrollElem
            );
        } else {
            scrollElem.scrollTo(targetScrollX, targetScrollY);
        }

        rect = getCaptureRect(
            captureElements,
            {
                allowViewportOverflow: allowViewportOverflow,
                scrollElem: scrollElem,
                viewportWidth: viewportWidth,
                documentHeight: documentHeight
            },
            logger
        );

        ignoreAreas = findIgnoreAreas(
            opts.ignoreSelectors,
            {
                scrollElem: scrollElem,
                pixelRatio: pixelRatio,
                viewportWidth: viewportWidth,
                documentHeight: documentHeight
            },
            logger
        );

        safeArea = getSafeAreaRect(
            rect,
            captureElements,
            {
                scrollElem: scrollElem,
                viewportWidth: viewportWidth,
                viewportHeight: viewportHeight
            },
            logger
        );

        logger("  capture rect after scrolling to capture area:", rect);
    } else if (!viewPort.rectIntersects(rect)) {
        // Element is completely outside viewport with no intersection - always error
        return {
            errorCode: "OUTSIDE_OF_VIEWPORT",
            message:
                "Can not capture element, because it is completely outside of viewport with no intersection. " +
                'Try to set "captureElementFromTop=true" to scroll to it before capture.',
            debugLog: logger()
        };
    }

    // Check if element has intersection with safeArea (viewport minus sticky/fixed interfering elements)
    var safeAreaRect = new Rect({
        left: safeArea.left + util.getScrollLeft(scrollElem) + (scrollElem !== window ? window.pageXOffset : 0),
        top: safeArea.top + util.getScrollTop(scrollElem) + (scrollElem !== window ? window.pageYOffset : 0),
        width: safeArea.width,
        height: safeArea.height
    });

    if (!safeAreaRect.rectIntersects(rect)) {
        // Element has no intersection with safe area - completely obscured by sticky/fixed elements
        return {
            errorCode: "OUTSIDE_OF_SAFE_AREA",
            message:
                "Can not capture element at position: " +
                rect.toString() +
                ", because it has no intersection with the safe area at position: " +
                safeAreaRect.toString() +
                ". " +
                "The element is completely obscured by fixed or sticky elements. " +
                'Try to set "captureElementFromTop=true" to scroll to it before capture.',
            debugLog: logger()
        };
    }

    var visibleAreaRect = getVisibleAreaRect({
        scrollElem: scrollElem,
        viewportWidth: viewportWidth,
        viewportHeight: viewportHeight
    });

    if (allowViewportOverflow && viewPort.rectIntersects(rect)) {
        // Element has intersection with viewport and overflow is allowed - adjust bounds
        rect.overflowsTopBound(viewPort) && rect.recalculateHeight(viewPort);
        rect.overflowsLeftBound(viewPort) && rect.recalculateWidth(viewPort);
    } else if (
        !captureElementFromTop &&
        !allowViewportOverflow &&
        (topmostCaptureElementTop < visibleAreaRect.top ||
            topmostCaptureElementTop >= visibleAreaRect.top + visibleAreaRect.height)
    ) {
        // captureElementFromTop is false, element is outside safe area, overflow not allowed - error
        return {
            errorCode: "OUTSIDE_OF_VISIBLE_AREA",
            message:
                "Can not capture element, because it is outside of the visible area (viewport area minus interfering sticky/fixed elements).\n" +
                "Top bound of capture area is: " +
                topmostCaptureElementTop +
                ", visible area is: " +
                visibleAreaRect.toString() +
                "\n" +
                "The element might be obscured by fixed or sticky elements. " +
                'Try to set "captureElementFromTop=true" to scroll to it before capture' +
                ' or to set "allowViewportOverflow=true" to ignore this error. ' +
                'Or try to set "selectorToScroll" to a parent element of the element to capture.',
            debugLog: logger()
        };
    }

    if (disableAnimation) {
        disableFrameAnimationsUnsafe();
    }

    var disableHover = opts.disableHover;
    var pointerEventsDisabled = false;
    if (disableHover === "always") {
        logger("adding stylesheet with pointer-events: none on all elements");
        disablePointerEventsUnsafe();
        pointerEventsDisabled = true;
    } else if (disableHover === "when-scrolling-needed" && opts.compositeImage) {
        var scrollOffsetTop = scrollElem === window || !scrollElem.parentElement ? 0 : util.getScrollTop(scrollElem);
        var rectTopInViewport = rect.top - scrollOffsetTop - window.scrollY;
        var needsScrolling =
            rectTopInViewport < safeArea.top || rectTopInViewport + rect.height > safeArea.top + safeArea.height;

        if (needsScrolling) {
            logger("adding stylesheet with pointer-events: none on all elements (composite capture needs scrolling)");
            disablePointerEventsUnsafe();
            pointerEventsDisabled = true;
        }
    }

    logger("prepareScreenshotUnsafe, final capture rect:", rect);
    logger("prepareScreenshotUnsafe, pixelRatio:", pixelRatio);

    return {
        captureArea: rect.scale(pixelRatio).serialize(),
        ignoreAreas: ignoreAreas,
        viewport: new Rect({
            left: util.getScrollLeft(scrollElem),
            top: util.getScrollTop(scrollElem),
            width: viewportWidth,
            height: viewportHeight
        })
            .scale(pixelRatio)
            .serialize(),
        viewportOffset: {
            top: Math.floor(window.scrollY * pixelRatio),
            left: Math.floor(window.scrollX * pixelRatio)
        },
        safeArea: safeArea.scale(pixelRatio).serialize(),
        documentHeight: Math.ceil(documentHeight * pixelRatio),
        documentWidth: Math.ceil(documentWidth * pixelRatio),
        canHaveCaret: isEditable(document.activeElement),
        pixelRatio: pixelRatio,
        scrollElementOffset: {
            top:
                scrollElem === window || scrollElem.parentElement === null
                    ? 0
                    : Math.floor(util.getScrollTop(scrollElem) * pixelRatio),
            left:
                scrollElem === window || scrollElem.parentElement === null
                    ? 0
                    : Math.floor(util.getScrollLeft(scrollElem) * pixelRatio)
        },
        pointerEventsDisabled: pointerEventsDisabled,
        debugLog: logger()
    };
}

function createDefaultTrustedTypesPolicy() {
    if (window.trustedTypes && window.trustedTypes.createPolicy) {
        window.trustedTypes.createPolicy("default", {
            createHTML: function (string) {
                return string;
            }
        });
    }
}

function disableFrameAnimationsUnsafe() {
    var everyElementSelector = "*:not(#testplane-q.testplane-w.testplane-e.testplane-r.testplane-t.testplane-y)";
    var everythingSelector = ["", "::before", "::after"]
        .map(function (pseudo) {
            return everyElementSelector + pseudo;
        })
        .join(", ");

    var styleElements = [];

    function appendDisableAnimationStyleElement(root) {
        var styleElement = document.createElement("style");
        styleElement.innerHTML =
            everythingSelector +
            [
                "{",
                "    animation-delay: 0ms !important;",
                "    animation-duration: 0ms !important;",
                "    animation-timing-function: step-start !important;",
                "    transition-timing-function: step-start !important;",
                "    scroll-behavior: auto !important;",
                "    transition: none !important;",
                "}"
            ].join("\n");

        root.appendChild(styleElement);
        styleElements.push(styleElement);
    }

    util.forEachRoot(function (root) {
        try {
            appendDisableAnimationStyleElement(root);
        } catch (err) {
            if (err && err.message && err.message.includes("This document requires 'TrustedHTML' assignment")) {
                createDefaultTrustedTypesPolicy();

                appendDisableAnimationStyleElement(root);
            } else {
                throw err;
            }
        }
    });

    window.__cleanupAnimation = function () {
        for (var i = 0; i < styleElements.length; i++) {
            // IE11 doesn't have remove() on node
            styleElements[i].parentNode.removeChild(styleElements[i]);
        }

        delete window.__cleanupAnimation;
    };
}

function disablePointerEventsUnsafe() {
    var everyElementSelector = "*:not(#testplane-q.testplane-w.testplane-e.testplane-r.testplane-t.testplane-y)";
    var everythingSelector = ["", "::before", "::after"]
        .map(function (pseudo) {
            return everyElementSelector + pseudo;
        })
        .join(", ");

    var styleElements = [];

    function appendDisablePointerEventsStyleElement(root) {
        var styleElement = document.createElement("style");
        styleElement.innerHTML = everythingSelector + ["{", "    pointer-events: none !important;", "}"].join("\n");

        root.appendChild(styleElement);
        styleElements.push(styleElement);
    }

    util.forEachRoot(function (root) {
        try {
            appendDisablePointerEventsStyleElement(root);
        } catch (err) {
            if (err && err.message && err.message.includes("This document requires 'TrustedHTML' assignment")) {
                createDefaultTrustedTypesPolicy();

                appendDisablePointerEventsStyleElement(root);
            } else {
                throw err;
            }
        }
    });

    exports.cleanupPointerEvents = function () {
        for (var i = 0; i < styleElements.length; i++) {
            styleElements[i].parentNode.removeChild(styleElements[i]);
        }
        exports.cleanupPointerEvents = function () {};
    };
}

exports.resetZoom = function () {
    var meta = lib.queryFirst('meta[name="viewport"]');
    if (!meta) {
        meta = document.createElement("meta");
        meta.name = "viewport";
        var head = lib.queryFirst("head");
        head && head.appendChild(meta);
    }
    meta.content = "width=device-width,initial-scale=1.0,user-scalable=no";
};

function getBoundingClientContentRect(element) {
    var elemStyle = lib.getComputedStyle(element);
    var borderLeft = parseFloat(elemStyle.borderLeftWidth) || 0;
    var borderTop = parseFloat(elemStyle.borderTopWidth) || 0;
    var borderRight = parseFloat(elemStyle.borderRightWidth) || 0;
    var borderBottom = parseFloat(elemStyle.borderBottomWidth) || 0;

    return new Rect({
        left: element.getBoundingClientRect().left + borderLeft,
        top: element.getBoundingClientRect().top + borderTop,
        width: element.getBoundingClientRect().width - borderLeft - borderRight,
        height: element.getBoundingClientRect().height - borderTop - borderBottom
    });
}

function getVisibleAreaRect(opts) {
    var scrollElem = opts.scrollElem;
    var viewportWidth = opts.viewportWidth;
    var viewportHeight = opts.viewportHeight;

    if (scrollElem === window) {
        return new Rect({ left: 0, top: 0, width: viewportWidth, height: viewportHeight });
    } else {
        var scrollElemBoundingRect = getBoundingClientContentRect(scrollElem);

        var viewportRect = new Rect({ left: 0, top: 0, width: viewportWidth, height: viewportHeight });

        var scrollElemInsideViewport = _getIntersectionRect(scrollElemBoundingRect, viewportRect);

        return scrollElemInsideViewport || viewportRect;
    }
}

function getSafeAreaRect(captureArea, captureElements, opts, logger) {
    // Safe area is the dimensions of current scrollable container minus vertical space of sticky elements that may interfere with our target elements.
    if (!captureArea || !opts) {
        return new Rect({
            left: 0,
            top: 0,
            width: (opts || {}).viewportWidth || 0,
            height: (opts || {}).viewportHeight || 0
        });
    }

    var scrollElem = opts.scrollElem;
    var viewportHeight = opts.viewportHeight;

    // 1. Base safe area equals the visible rectangle of the scroll container.
    var safeArea = getVisibleAreaRect(opts);
    var originalSafeArea = new Rect({
        left: safeArea.left,
        top: safeArea.top,
        width: safeArea.width,
        height: safeArea.height
    });

    var captureAreaInViewportCoords = new Rect({
        left: captureArea.left - util.getScrollLeft(scrollElem),
        top: captureArea.top - util.getScrollTop(scrollElem),
        width: captureArea.width,
        height: captureArea.height
    });

    // 2. Build z-index chains for all capture elements
    //    One z-chain is a list of objects: { stacking context, z-index } -> { stacking context, z-index } -> ...
    //    It is used to determine which element is on top of the other.
    var targetChains = captureElements.map(function (el) {
        return util.buildZChain(el);
    });

    // 3. Detect interfering elements
    var root = document.documentElement;
    var allElements = root.querySelectorAll ? root.querySelectorAll("*") : [];

    var interferingRects = [];

    allElements.forEach(function (el) {
        logger("getSafeAreaRect(), processing potentially interfering element: " + el.classList.toString());
        // Skip elements that contain capture elements
        if (
            util.some(captureElements, function (capEl) {
                return el.contains(capEl);
            })
        ) {
            return;
        }

        var computedStyle = lib.getComputedStyle(el);
        var position = computedStyle.position;
        var br = el.getBoundingClientRect();

        // Skip invisible elements
        if (br.width < 1 || br.height < 1) {
            return;
        }

        // Skip elements that don't horizontally intersect with capture area
        if (br.right <= captureAreaInViewportCoords.left || br.left >= captureAreaInViewportCoords.right) {
            return;
        }

        var likelyInterferes = false;
        if (position === "fixed") {
            likelyInterferes = true;
        } else if (position === "absolute") {
            // Skip absolutely positioned elements that are inside capture elements
            if (
                captureElements.some(function (captureEl) {
                    return captureEl.contains(el);
                })
            ) {
                return;
            }
            // Absolute elements interfere only if positioned relative to ancestor outside scroll container
            var containingBlock = util.findContainingBlock(el);
            // scrollElem may be window, in which case it doesn't have a contains method
            if (
                containingBlock &&
                scrollElem &&
                typeof scrollElem.contains === "function" &&
                !scrollElem.contains(containingBlock)
            ) {
                likelyInterferes = true;
            }
        } else if (position === "sticky") {
            // Sticky elements interfere based on their top/bottom values
            var topValue = parseFloat(computedStyle.top);
            var bottomValue = parseFloat(computedStyle.bottom);

            var scrollParent = util.getScrollParent(el, logger);
            if (scrollParent && typeof scrollParent.getBoundingClientRect === "function") {
                var scrollParentBr = scrollParent.getBoundingClientRect();
                topValue += scrollParentBr.top;
            }

            if (!isNaN(topValue)) {
                br = {
                    left: br.left,
                    top: topValue,
                    width: br.width,
                    height: br.height
                };
                likelyInterferes = true;
                logger("  it is sticky to top! topValue: " + topValue + " bounding rect: " + JSON.stringify(br));
            } else if (!isNaN(bottomValue)) {
                var viewportBottom = util.isRootElement(scrollElem) ? viewportHeight : safeArea.top + safeArea.height;
                br = {
                    left: br.left,
                    top: viewportBottom - bottomValue - br.height,
                    width: br.width,
                    height: br.height
                };
                likelyInterferes = true;
                logger(
                    "  it is sticky to bottom! bottomValue: " + bottomValue + " bounding rect: " + JSON.stringify(br)
                );
            }
        }

        logger("  likely interferes: " + likelyInterferes);

        if (likelyInterferes) {
            var candChain = util.buildZChain(el);

            var behindAll = targetChains.every(function (tChain) {
                return util.isChainBehind(candChain, tChain);
            });

            logger("  is candidate z chain behind all target chains? : " + behindAll);

            if (!behindAll) {
                interferingRects.push({ x: br.left, y: br.top, width: br.width, height: br.height });
            }
        }
    });

    logger("getSafeAreaRect, safeArea before shrinking:", safeArea);
    logger("getSafeAreaRect, interferingRects:", interferingRects);

    // 4. Shrink safe area according to interfering elements
    interferingRects.forEach(function (br) {
        logger("getSafeAreaRect, interferingRects, br:", br);

        var safeAreaBottom = safeArea.top + safeArea.height;

        var shrinkTop = br.y + br.height - safeArea.top;
        var shrinkBottom = safeAreaBottom - br.y;

        logger("  getSafeAreaRect, shrinkTop:", shrinkTop);
        logger("  getSafeAreaRect, shrinkBottom:", shrinkBottom);

        var resultingTop = safeArea.top,
            resultingHeight = safeArea.height;

        if (shrinkTop < shrinkBottom) {
            resultingTop = Math.max(safeArea.top, br.y + br.height);
            resultingHeight = safeAreaBottom - resultingTop;
        } else {
            resultingHeight = Math.min(safeArea.height, br.y - safeArea.top);
        }

        if (resultingHeight < originalSafeArea.height / 2) {
            logger(
                "  getSafeAreaRect, resultingHeight is less than half of originalSafeArea.height, skipping due to too large shrinking"
            );
            return;
        }

        safeArea.top = resultingTop;
        safeArea.height = resultingHeight;

        logger("  getSafeAreaRect, safeArea after shrinking:", safeArea);
    });

    // 5. Ensure we didn't shrink more than 50% of original height
    if (safeArea.height < originalSafeArea.height / 2) {
        safeArea.top = originalSafeArea.top;
        safeArea.height = originalSafeArea.height;
    }

    logger("getSafeAreaRect, final safeArea after shrinking:", safeArea);
    logger("getSafeAreaRect, final originalSafeArea:", originalSafeArea);

    return new Rect({
        left: Math.floor(safeArea.left),
        top: Math.floor(safeArea.top),
        width: Math.floor(safeArea.width),
        height: Math.floor(safeArea.height)
    });
}

function _getIntersectionRect(rectA, rectB) {
    var left = Math.max(rectA.left, rectB.left);
    var top = Math.max(rectA.top, rectB.top);
    var right = Math.min(rectA.right, rectB.right);
    var bottom = Math.min(rectA.bottom, rectB.bottom);

    if (left >= right || top >= bottom) {
        return null;
    }

    return new Rect({ left: left, top: top, right: right, bottom: bottom });
}

function getCaptureElements(selectors) {
    var elements = [];
    for (var i = 0; i < selectors.length; i++) {
        var element = lib.queryFirst(selectors[i]);
        if (!element) {
            return {
                errorCode: "NOTFOUND",
                message: "Could not find element with css selector specified in setCaptureElements: " + selectors[i],
                selector: selectors[i]
            };
        }
        elements.push(element);
    }

    return elements;
}

function getCaptureRect(captureElements, opts, logger) {
    var element,
        elementRect,
        rect = opts.initialRect;
    for (var i = 0; i < captureElements.length; i++) {
        element = captureElements[i];

        elementRect = getElementCaptureRect(element, opts, logger);

        logger("getElementCaptureRect resulting elementRect:", elementRect);

        if (elementRect) {
            rect = rect ? rect.merge(elementRect) : elementRect;
        }
    }

    return rect ? rect.round() : rect;
}

function configurePixelRatio(usePixelRatio) {
    if (usePixelRatio === false) {
        return 1;
    }

    if (window.devicePixelRatio) {
        return window.devicePixelRatio;
    }

    // for ie6-ie10 (https://developer.mozilla.org/ru/docs/Web/API/Window/devicePixelRatio)
    return window.screen.deviceXDPI / window.screen.logicalXDPI || 1;
}

function findIgnoreAreas(selectors, opts, logger) {
    var result = [];
    util.each(selectors, function (selector) {
        var elements = queryIgnoreAreas(selector);

        util.each(elements, function (elem) {
            var ignoreArea = addIgnoreArea.call(result, elem, opts, logger);

            return ignoreArea;
        });
    });

    return result;
}

function addIgnoreArea(element, opts, logger) {
    var rect = element && getElementCaptureRect(element, opts, logger);

    if (!rect) {
        return;
    }

    var ignoreArea = rect.round().scale(opts.pixelRatio).serialize();

    this.push(ignoreArea);
}

function isHidden(css, clientRect) {
    return (
        css.display === "none" ||
        css.visibility === "hidden" ||
        css.opacity < 0.0001 ||
        clientRect.width < 0.0001 ||
        clientRect.height < 0.0001
    );
}

function getElementCaptureRect(element, opts, logger) {
    /* Terminology:
       - clientRect = the result of calling getBoundingClientRect on the element
       - extRect = clientRect + outline + box shadow
       - elementCaptureRect = sum of extRects of the element and its pseudo-elements
       - captureRect = sum of all elementCaptureRects for each selector to capture
    */
    var pseudo = [":before", ":after"],
        css = lib.getComputedStyle(element),
        clientRect = rect.getAbsoluteClientRect(element, opts, logger);
    logger("getAbsoluteClientRect result: ", clientRect);

    if (isHidden(css, clientRect)) {
        return null;
    }

    var elementRect = getExtRect(css, clientRect, opts.allowViewportOverflow);

    util.each(pseudo, function (pseudoEl) {
        css = lib.getComputedStyle(element, pseudoEl);
        elementRect = elementRect.merge(getExtRect(css, clientRect, opts.allowViewportOverflow));
    });

    return elementRect;
}

function getExtRect(css, clientRect, allowViewportOverflow) {
    var shadows = parseBoxShadow(css.boxShadow),
        outline = parseInt(css.outlineWidth, 10);

    if (isNaN(outline)) {
        outline = 0;
    }

    return adjustRect(clientRect, shadows, outline, allowViewportOverflow);
}

function parseBoxShadow(value) {
    value = value || "";
    var regex = /[-+]?\d*\.?\d+px/g,
        values = value.split(","),
        results = [],
        match;

    util.each(values, function (value) {
        if ((match = value.match(regex))) {
            results.push({
                offsetX: parseFloat(match[0]),
                offsetY: parseFloat(match[1]) || 0,
                blurRadius: parseFloat(match[2]) || 0,
                spreadRadius: parseFloat(match[3]) || 0,
                inset: value.indexOf("inset") !== -1
            });
        }
    });
    return results;
}

function adjustRect(rect, shadows, outline, allowViewportOverflow) {
    var shadowRect = calculateShadowRect(rect, shadows, allowViewportOverflow),
        outlineRect = calculateOutlineRect(rect, outline, allowViewportOverflow);
    return shadowRect.merge(outlineRect);
}

function calculateOutlineRect(rect, outline, allowViewportOverflow) {
    var top = rect.top - outline,
        left = rect.left - outline;

    return new Rect({
        top: allowViewportOverflow ? top : Math.max(0, top),
        left: allowViewportOverflow ? left : Math.max(0, left),
        bottom: rect.bottom + outline,
        right: rect.right + outline
    });
}

function calculateShadowRect(rect, shadows, allowViewportOverflow) {
    var extent = calculateShadowExtent(shadows),
        left = rect.left + extent.left,
        top = rect.top + extent.top;

    return new Rect({
        left: allowViewportOverflow ? left : Math.max(0, left),
        top: allowViewportOverflow ? top : Math.max(0, top),
        width: rect.width - extent.left + extent.right,
        height: rect.height - extent.top + extent.bottom
    });
}

function calculateShadowExtent(shadows) {
    var result = { top: 0, left: 0, right: 0, bottom: 0 };

    util.each(shadows, function (shadow) {
        if (shadow.inset) {
            //skip inset shadows
            return;
        }

        var blurAndSpread = shadow.spreadRadius + shadow.blurRadius;
        result.left = Math.min(shadow.offsetX - blurAndSpread, result.left);
        result.right = Math.max(shadow.offsetX + blurAndSpread, result.right);
        result.top = Math.min(shadow.offsetY - blurAndSpread, result.top);
        result.bottom = Math.max(shadow.offsetY + blurAndSpread, result.bottom);
    });
    return result;
}

function isEditable(element) {
    if (!element) {
        return false;
    }
    return /^(input|textarea)$/i.test(element.tagName) || element.isContentEditable;
}

function scrollToCaptureAreaInSafari(viewportCurr, captureArea, scrollElem) {
    var mainDocumentElem = util.getMainDocumentElem();
    var documentHeight = Math.round(mainDocumentElem.scrollHeight);
    var viewportHeight = Math.round(mainDocumentElem.clientHeight);
    var maxScrollByY = documentHeight - viewportHeight;

    scrollElem.scrollTo(viewportCurr.left, Math.min(captureArea.top, maxScrollByY));

    // TODO: uncomment after fix bug in safari - https://bugs.webkit.org/show_bug.cgi?id=179735
    /*
    var viewportAfterScroll = new Rect({
        left: util.getScrollLeft(scrollElem),
        top: util.getScrollTop(scrollElem),
        width: viewportCurr.width,
        height: viewportCurr.height
    });

    if (!viewportAfterScroll.rectInside(captureArea)) {
        scrollElem.scrollTo(captureArea.left, captureArea.top);
    }
    */
}
