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

// Terminology
// - clientRect - the result of calling getBoundingClientRect of the element
// - extRect - clientRect + outline + box shadow
// - elementCaptureRect - sum of extRects of the element and its pseudo-elements
// - captureRect - sum of all elementCaptureRect for each captureSelectors

exports.prepareScreenshot = function prepareScreenshot(areas, opts) {
    opts = opts || {};
    try {
        return prepareScreenshotUnsafe(areas, opts);
    } catch (e) {
        return {
            error: "JS",
            message: e.stack || e.message
        };
    }
};

exports.disableFrameAnimations = function disableFrameAnimations() {
    try {
        return disableFrameAnimationsUnsafe();
    } catch (e) {
        return {
            error: "JS",
            message: e.stack || e.message
        };
    }
};

exports.cleanupFrameAnimations = function cleanupFrameAnimations() {
    if (window.__cleanupAnimation) {
        window.__cleanupAnimation();
    }
};

function createDebugLogger(opts) {
    var log = "";
    if (opts.debug) {
        return function () {
            for (var i = 0; i < arguments.length; i++) {
                if (typeof arguments[i] === "object") {
                    log += JSON.stringify(arguments[i], null, 2) + "\n";
                } else {
                    log += arguments[i] + "\n";
                }
            }

            return log;
        }
    }

    return function () {};
}

function prepareScreenshotUnsafe(areas, opts) {
    var logger = createDebugLogger(opts);

    var allowViewportOverflow = opts.allowViewportOverflow;
    var captureElementFromTop = opts.captureElementFromTop;
    var disableAnimation = opts.disableAnimation;
    var scrollElem = window;

    if (opts.selectorToScroll) {
        scrollElem = document.querySelector(opts.selectorToScroll);

        if (!scrollElem) {
            return {
                error: "NOTFOUND",
                message:
                    'Could not find element with css selector specified in "selectorToScroll" option: ' +
                    opts.selectorToScroll,
                selector: opts.selectorToScroll
            };
        }

        // TODO: validate that scrollElem is parent of all areas.
    }

    var mainDocumentElem = util.getMainDocumentElem(),
        viewportWidth = mainDocumentElem.clientWidth,
        viewportHeight = mainDocumentElem.clientHeight,
        documentWidth = mainDocumentElem.scrollWidth,
        documentHeight = mainDocumentElem.scrollHeight,
        viewPort = new Rect({
            left: util.getScrollLeft(window),
            top: util.getScrollTop(window),
            width: viewportWidth,
            height: viewportHeight
        }),
        pixelRatio = configurePixelRatio(opts.usePixelRatio),
        rect,
        selectors = [];

    logger("prepareScreenshotUnsafe, viewport at the start:", viewPort);

    areas.forEach(function (area) {
        if (Rect.isRect(area)) {
            rect = rect ? rect.merge(new Rect(area)) : new Rect(area);
        } else {
            selectors.push(area);
        }
    });

    var captureElements = getCaptureElements(selectors);

    rect = getCaptureRect(captureElements, {
        initialRect: rect,
        allowViewportOverflow: allowViewportOverflow,
        scrollElem: scrollElem,
        viewportWidth: viewportWidth,
        documentHeight: documentHeight
    }, logger);
    logger("getCaptureRect, rect:", rect);

    if (!rect) {
        return {
            error: "HIDDEN",
            message: "Area with css selector : " + selectors + " is hidden",
            selector: selectors
        }
    }

    if (rect.error) {
        return rect;
    }

    var ignoreAreas = findIgnoreAreas(opts.ignoreSelectors, {
        scrollElem: scrollElem,
        pixelRatio: pixelRatio,
        viewportWidth: viewportWidth,
        documentHeight: documentHeight
    }, logger)

    var safeArea = getSafeAreaRect(rect, captureElements, {
        scrollElem: scrollElem,
        viewportWidth: viewportWidth,
        viewportHeight: viewportHeight
    }, logger);

    if (captureElementFromTop && !viewPort.rectInside(rect)) {
        logger("captureElementFromTop=true and rect is outside of viewport, performing scroll");
        if (opts.selectorToScroll) {
            var scrollElemBoundingRect = getBoundingClientContentRect(scrollElem);
            logger("captureElementFromTop=true, scrollElemBoundingRect:", scrollElemBoundingRect);
            var scrollY = Math.floor(scrollElemBoundingRect.top) - safeArea.top;
            window.scrollTo(window.scrollX, scrollY); // TODO: scroll not to the top of the scroll element, but to the top of the safe area
            logger("captureElementFromTop=true, scrolled to: " + scrollY);

            rect = getCaptureRect(captureElements, {
                // initialRect: rect,
                allowViewportOverflow: allowViewportOverflow,
                scrollElem: scrollElem,
                viewportWidth: viewportWidth,
                documentHeight: documentHeight
            }, logger)//.translate(0, window.scrollY);

            ignoreAreas = findIgnoreAreas(opts.ignoreSelectors, {
                scrollElem: scrollElem,
                pixelRatio: pixelRatio,
                viewportWidth: viewportWidth,
                documentHeight: documentHeight
            }, logger);

            safeArea = getSafeAreaRect(rect, captureElements, {
                scrollElem: scrollElem,
                viewportWidth: viewportWidth,
                viewportHeight: viewportHeight
            }, logger);

            viewPort = new Rect({
                left: util.getScrollLeft(window),
                top: util.getScrollTop(window),
                width: viewportWidth,
                height: viewportHeight
            })
        }
        // Scroll so that capture area aligns with the top border of safeArea
        var targetScrollY = Math.max(rect.top - (scrollElemBoundingRect || {top: 0}).top - safeArea.top, 0); // TODO: this is most likely wrong, because rect is in global coordinates, but safeArea is in viewport coordinates
        // By how much should we scroll inside container so that target element is aligned with the top border of safeArea?
        // - How do we compute 
        var targetScrollX = scrollElem.offsetLeft;

        logger("captureElementFromTop=true, performing scroll. targetScrollY:", targetScrollY, "targetScrollX:", targetScrollX);

        if (util.isSafariMobile()) {
            scrollToCaptureAreaInSafari(viewPort, new Rect({ left: rect.left, top: targetScrollY, width: rect.width, height: rect.height }), scrollElem);
        } else {
            scrollElem.scrollTo(targetScrollX, targetScrollY);
        }

        rect = getCaptureRect(captureElements, {
            // initialRect: rect,
            allowViewportOverflow: allowViewportOverflow,
            scrollElem: scrollElem,
            viewportWidth: viewportWidth,
            documentHeight: documentHeight
        }, logger)//.translate(0, window.scrollY);

        ignoreAreas = findIgnoreAreas(opts.ignoreSelectors, {
            scrollElem: scrollElem,
            pixelRatio: pixelRatio,
            viewportWidth: viewportWidth,
            documentHeight: documentHeight
        }, logger);

        safeArea = getSafeAreaRect(rect, captureElements, {
            scrollElem: scrollElem,
            viewportWidth: viewportWidth,
            viewportHeight: viewportHeight
        }, logger);

        viewPort = new Rect({
            left: util.getScrollLeft(window),
            top: util.getScrollTop(window),
            width: viewportWidth,
            height: viewportHeight
        })
    }

    if (allowViewportOverflow && viewPort.rectIntersects(rect)) {
        rect = _getIntersectionRect(viewPort, rect);
    }

    if (!allowViewportOverflow && !viewPort.rectIntersects(rect)) {
        return {
            error: "OUTSIDE_OF_VIEWPORT",
            message:
                "Can not capture element, because it is outside of viewport. " +
                'Try to set "captureElementFromTop=true" to scroll to it before capture' +
                ' or to set "allowViewportOverflow=true" to ignore viewport overflow.'
        };
    }

    if (disableAnimation) {
        disableFrameAnimationsUnsafe();
    }

    logger("prepareScreenshotUnsafe, rect:", rect);
    logger("prepareScreenshotUnsafe, pixelRatio:", pixelRatio);

    return {
        captureArea: rect.scale(pixelRatio).round().serialize(),
        // scrollElementArea: scrollElemBoundingRect.round().scale(pixelRatio).serialize(),
        ignoreAreas: ignoreAreas,
        viewport: viewPort.scale(pixelRatio).round().serialize(),
        safeArea: safeArea.scale(pixelRatio).round().serialize(),
        documentHeight: Math.ceil(documentHeight * pixelRatio),
        documentWidth: Math.ceil(documentWidth * pixelRatio),
        canHaveCaret: isEditable(document.activeElement),
        pixelRatio: pixelRatio,
        containerScrollY: scrollElem === window ? 0 : Math.floor(util.getScrollTop(scrollElem) * pixelRatio),
        containerScrollX: scrollElem === window ? 0 : Math.floor(util.getScrollLeft(scrollElem) * pixelRatio),
        windowScrollY: Math.floor(window.scrollY) * pixelRatio,
        windowScrollX: Math.floor(window.scrollX) * pixelRatio,
        debugLog: logger()
    };
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

    function createDefaultTrustedTypesPolicy() {
        if (window.trustedTypes && window.trustedTypes.createPolicy) {
            window.trustedTypes.createPolicy("default", {
                createHTML: function (string) {
                    return string;
                }
            });
        }
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

function getSafeAreaRect(captureArea, captureElements, opts, logger) {
    /**
     * What is safe area?
     *  - It's dimensions of current scrollable container minus vertical space of sticky elements that interfere with our target element.
     *  *This implementation follows the high-level algorithm described above. It intentionally keeps the logic
     *    relatively simple and fast – it should be good enough for the vast majority of real-world pages while
     *    avoiding any heavyweight DOM traversing.*
     *
     * 1. Determine the "container" rectangle – it is either the whole viewport (if we scroll the window directly)
     *    or the bounding rectangle of the element we actually scroll.
     * 2. Collect potentially-sticky elements that may intersect with the target element horizontally.
     *    We use a heuristic: an element whose computed style `position` is either `sticky` or `fixed` is considered
     *    sticky. This is much cheaper than the full "scroll-twice and compare" approach, but works well in practice.
     * 3. For every such element that is *outside* of the target element vertically we shrink the container from the
     *    respective side (top or bottom). We never shrink the safe area by more than 50 % of its original height.
     */

    if (!captureArea || !opts) {
        return new Rect({ left: 0, top: 0, width: (opts || {}).viewportWidth || 0, height: (opts || {}).viewportHeight || 0 });
    }

    var scrollElem = opts.scrollElem;
    var viewportWidth = opts.viewportWidth;
    var viewportHeight = opts.viewportHeight;

    // 1. Base safe area equals the visible rectangle of the scroll container.
    var safeArea, originalSafeArea;
    if (scrollElem === window) {
        safeArea = new Rect({ left: 0, top: 0, width: viewportWidth, height: viewportHeight });
        originalSafeArea = new Rect({ left: safeArea.left, top: safeArea.top, width: safeArea.width, height: safeArea.height });
    } else {
        var scrollElemBoundingRect = getBoundingClientContentRect(scrollElem);

        var viewportRect = new Rect({ left: 0, top: 0, width: viewportWidth, height: viewportHeight });

        var scrollElemInsideViewport = _getIntersectionRect(scrollElemBoundingRect, viewportRect);

        safeArea = scrollElemInsideViewport || viewportRect;
        originalSafeArea = new Rect({ left: safeArea.left, top: safeArea.top, width: safeArea.width, height: safeArea.height });
    }

    // Convert captureArea to viewport coordinates to simplify further calculations
    var captureAreaInViewportCoords = new Rect({
        left: captureArea.left - util.getScrollLeft(scrollElem),
        top: captureArea.top - util.getScrollTop(scrollElem),
        width: captureArea.width,
        height: captureArea.height
    });

    // Build map of stackingContextRoot -> max z-index for all capture elements
    var targetContextZ = new Map();
    captureElements.forEach(function (el) {
        var currentElement = el;
        var ctx = _getStackingContextRoot(el);
        var zVal = _getEffectiveZIndex(currentElement);
        while (ctx !== document.documentElement) {
            logger('setting z-index for ctx:', ctx.classList.toString(), zVal);
            targetContextZ.set(ctx, zVal);
            
            currentElement = ctx;
            ctx = _getStackingContextRoot(ctx);
            zVal = _getEffectiveZIndex(currentElement);
        }

        logger('setting z-index for ctx:', document.documentElement.classList.toString(), zVal);
        targetContextZ.set(document.documentElement, zVal);
    });
    // logger("getSafeAreaRect, targetContextZ:", targetContextZ.entries());

    // 2. Detect interfering elements heuristically
    var root = document.documentElement;
    var allElements = root.querySelectorAll ? root.querySelectorAll("*") : [];

    var interferingRects = [];
    
    allElements.forEach(function (el) {
        // Skip elements that are part of capture elements
        if (util.some(captureElements, function (capEl) {
            // if (typeof capEl.contains !== "function" || typeof el.contains !== "function") {
            //     console.log("WARNING!!!! getSafeAreaRect, capEl.contains or el.contains is not a function");
            //     console.log("capEl:", capEl);
            //     console.log("el:", el);
            //     return true;
            // }
            return capEl.contains(el) || el.contains(capEl);
        })) {
            return;
        }

        var computedStyle = lib.getComputedStyle(el);
        var position = computedStyle.position;
        var br = el.getBoundingClientRect();
        // For z-index comparison later
        var elementCtx = _getStackingContextRoot(el);
        var elementZ = _getEffectiveZIndex(el);

        // Skip invisible elements
        if (br.width < 1 || br.height < 1) {
            return;
        }

        // Skip elements that don't horizontally intersect with capture area
        if (br.right <= captureAreaInViewportCoords.left || br.left >= captureAreaInViewportCoords.right) {
            return;
        }

        var shouldInterfere = false;

        if (position === "fixed") {
            // Fixed elements always interfere
            shouldInterfere = true;
        } else if (position === "absolute") {
            // Absolute elements interfere only if positioned relative to ancestor outside scroll container
            var containingBlock = findContainingBlock(el);
            // scrollElem may be window, in which case it doesn't have a contains method
            if (containingBlock && scrollElem && typeof scrollElem.contains === "function" && !scrollElem.contains(containingBlock)) {
                shouldInterfere = true;
            }
        } else if (position === "sticky") {
            // Sticky elements interfere based on their top/bottom values
            var topValue = parseFloat(computedStyle.top);
            var bottomValue = parseFloat(computedStyle.bottom);

            // TODO: determine which element this element sticks to
            
            // Create interference rect based on sticky positioning
            if (!isNaN(topValue)) {
                // Sticky to top - interferes from viewport top + topValue
                br = {
                    left: br.left,
                    top: topValue,
                    right: br.right,
                    bottom: topValue + br.height,
                    width: br.width,
                    height: br.height
                };
                shouldInterfere = true;
            } else if (!isNaN(bottomValue)) {
                // Sticky to bottom - interferes from viewport bottom - bottomValue - height
                var viewportBottom = (scrollElem === window) ? viewportHeight : safeArea.top + safeArea.height;
                br = {
                    left: br.left,
                    top: viewportBottom - bottomValue - br.height,
                    right: br.right,
                    bottom: viewportBottom - bottomValue,
                    width: br.width,
                    height: br.height
                };
                shouldInterfere = true;
            }
        }
        
        logger('getSafeAreaRect(), processing interfering element: ' + el.classList.toString() + ' shouldInterfere: ' + shouldInterfere);

        if (shouldInterfere) {
            if (!_isBehindTarget(elementCtx, elementZ, targetContextZ)) {
                interferingRects.push({ x: br.left, y: br.top, width: br.width, height: br.height });
            }
        }
    });

    logger("getSafeAreaRect, safeArea before shrinking:", safeArea);
    logger("getSafeAreaRect, interferingRects:", interferingRects);

    // 3. Shrink safe area according to interfering elements
    interferingRects.forEach(function (br) {
        logger("getSafeAreaRect, interferingRects, br:", br);
        var safeAreaBottom = safeArea.top + safeArea.height;

        logger("getSafeAreaRect, interferingRects, processing interference");
        
        // Determine how to shrink safe area
        var shrinkTop = br.y + br.height - safeArea.top;
        var shrinkBottom = safeAreaBottom - br.y;

        logger("getSafeAreaRect, shrinkTop:", shrinkTop);
        logger("getSafeAreaRect, shrinkBottom:", shrinkBottom);

        if (shrinkTop < shrinkBottom) {
            safeArea.top = Math.max(safeArea.top, br.y + br.height);
            safeArea.height = safeAreaBottom - safeArea.top;
        } else {
            safeArea.height = Math.min(safeArea.height, br.y - safeArea.top);
        }

        logger("getSafeAreaRect, safeArea after shrinking:", safeArea);
    });

    logger("getSafeAreaRect, final safeArea after shrinking:", safeArea);
    logger("getSafeAreaRect, final originalSafeArea:", originalSafeArea);

    // 4. Ensure we didn't shrink more than 50% of original height
    if (safeArea.height < originalSafeArea.height / 2) {
        safeArea.top = originalSafeArea.top;
        safeArea.height = originalSafeArea.height;
    }

    // 5. Ensure target element can still be fully captured in safe area
    // If shrinking cut off part of the capture area, expand safe area back
    // if (captureAreaInViewportCoords.top < safeArea.top) {
    //     safeArea.top = originalSafeArea.top;
    //     safeArea.height = originalSafeArea.height;
    // }
    
    // var captureBottomInViewport = captureAreaInViewportCoords.top + captureAreaInViewportCoords.height;
    // var safeAreaBottom = safeArea.top + safeArea.height;
    // if (captureBottomInViewport > safeAreaBottom) {
    //     // Target extends below safe area - expand safe area downward
    //     safeArea.height = captureBottomInViewport - safeArea.top;
    // }

    logger("getSafeAreaRect, final safeArea:", safeArea);

    return new Rect({
        left: safeArea.left,
        top: safeArea.top,
        width: safeArea.width,
        height: safeArea.height
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
                error: "NOTFOUND",
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
        logger('getCaptureRect, elementRect:', elementRect);
        if (elementRect) {
            rect = rect ? rect.merge(elementRect) : elementRect;
        }
    }

    logger('getCaptureRect, final rect:', rect);

    return rect;
        // ? rect.round()
        // : null;
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
    logger('finding ignoreAreas, selectors:', selectors);

    var result = [];
    util.each(selectors, function (selector) {
        var elements = queryIgnoreAreas(selector);

        util.each(elements, function (elem) {
            return addIgnoreArea.call(result, elem, opts, logger);
        });
    });

    return result;
}

function addIgnoreArea(element, opts, logger) {
    var rect = element && getElementCaptureRect(element, opts, logger);

    if (!rect) {
        return;
    }

    var ignoreArea = rect.scale(opts.pixelRatio).round().serialize();

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
    var pseudo = [":before", ":after"],
        css = lib.getComputedStyle(element),
        clientRect = rect.getAbsoluteClientRect(element, opts, logger);

    if (isHidden(css, clientRect)) {
        return null;
    }

    logger('getElementCaptureRect, clientRect:', clientRect);

    var elementRect = getExtRect(css, clientRect, opts.allowViewportOverflow);

    logger('getElementCaptureRect, elementRect after getExtRect() call:', elementRect);

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

function findContainingBlock(element) {
    var parent = element.parentElement;
    while (parent) {
        var style = lib.getComputedStyle(parent);
        if (["relative", "absolute", "fixed", "sticky"].includes(style.position) || style.transform !== "none" || style.perspective !== "none") {
            return parent;
        }
        parent = parent.parentElement;
    }
    return document.documentElement;
}

function _getStackingContextRoot(element) {
    var curr = element.parentElement;
    while (curr && curr !== document.documentElement) {
        var style = lib.getComputedStyle(curr);
        var position = style.position;
        var zIndex = style.zIndex;
        var opacity = parseFloat(style.opacity);
        var transform = style.transform !== 'none';
        var filter = style.filter !== 'none';
        var perspective = style.perspective !== 'none';

        var createsContext = (position !== 'static' && zIndex !== 'auto') || opacity < 1 || transform || filter || perspective || position === 'fixed' || position === 'sticky';
        if (createsContext) {
            return curr;
        }
        curr = curr.parentElement;
    }
    return document.documentElement;
}

function _getEffectiveZIndex(element) {
    var curr = element;
    while (curr && curr !== document.documentElement) {
        var style = lib.getComputedStyle(curr);
        var zIndexStr = style.zIndex;

        // If this ancestor creates a stacking context
        var position = style.position;
        var createsContext = (position !== 'static' && zIndexStr !== 'auto') || parseFloat(style.opacity) < 1 || style.transform !== 'none' || style.filter !== 'none' || style.perspective !== 'none' || position === 'fixed' || position === 'sticky';

        if (zIndexStr !== 'auto') {
            var num = parseFloat(zIndexStr);
            return isNaN(num) ? 0 : num;
        }

        if (createsContext) {
            // z-index is auto but this is the root of current stacking context → treat as 0
            return 0;
        }

        curr = curr.parentElement;
    }
    return 0;
}

function _isBehindTarget(elementCtx, elementZ, targetContextZ) {
    var ctx = elementCtx;
    var z = elementZ;
    while (ctx) {
        var targetZ = targetContextZ.get(ctx);
        if (targetZ !== undefined) {
            // Same stacking context as target elements
            return z < targetZ;
        }

        if (ctx === document.documentElement) {
            break;
        }

        // Move one level up: the parent stacking context of current ctx
        var parentCtx = _getStackingContextRoot(ctx.parentElement);
        z = _getEffectiveZIndex(ctx); // ctx's own z-index relative to parent
        ctx = parentCtx;
    }

    // Could not find common context -> assume it may overlap (not behind)
    return false;
}
