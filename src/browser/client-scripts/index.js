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
                    try {
                        log += JSON.stringify(arguments[i], null, 2) + "\n";
                    } catch (e) {
                        log += '<failed log message due to an error: ' + e;
                    }
                } else {
                    log += arguments[i] + "\n";
                }
            }

            return log;
        }
    }

    return function () {};
}

function getParentNode(node) {
    if (!node) return null;
    if (node instanceof ShadowRoot) return node.host;
    if (node instanceof Element) {
        var root = node.getRootNode();
        return node.parentElement || (root instanceof ShadowRoot ? root.host : null);
    }
    return node.parentNode; // for Text/Comment nodes
};

function getScrollParent(element, logger) {
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
        return getScrollParent(getParentNode(element), logger);
    }
    // try {

    // } catch (e) {
    //     logger('getScrollParent, failed to get computed style for element', element, e);
    //     logger('element tagName', element.tagName)
    //     return window;
    // }
    var canBeScrolled = computedStyleOverflowY === 'auto' || computedStyleOverflowY === 'scroll' || computedStyleOverflowY === 'overlay';

    if (hasOverflow && canBeScrolled) {
        if (element.tagName === 'BODY') {
            return window;
        }
        return element;
    } else {
        return getScrollParent(getParentNode(element), logger);
    }
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
    } else {
        // Try to determine it automatically or fallback to window
        var scrollParents = areas.map(function (selector) { return getScrollParent(document.querySelector(selector), logger)});
        // console.log('scroll parents:', scrollParents);
        if (scrollParents[0] !== null && scrollParents.every(function (element) { return scrollParents[0] === element })) {
            scrollElem = scrollParents[0];
            // console.log('Successfully determined scroll element!');
            // console.log(elementToScroll);
        // } else {
            // elementToScroll = window;
            // console.log('falling back to window.')
        }
    }

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
        // initialRect: rect,
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
    }, {y: 0}, logger)

    var safeArea = getSafeAreaRect(rect, captureElements, {
        scrollElem: scrollElem,
        viewportWidth: viewportWidth,
        viewportHeight: viewportHeight
    }, logger);

    var topmostCaptureElementTop = captureElements.reduce(function (top, currentElement) {
        var currentElementTop = currentElement.getBoundingClientRect().top;
        if (currentElementTop < top) {
            return currentElementTop;
        }
        return top;
    }, 9999999);

    if (captureElementFromTop && (topmostCaptureElementTop < 0 || topmostCaptureElementTop >= viewportHeight)) {
        logger("captureElementFromTop=true and rect is outside of viewport, performing scroll");
        if (scrollElem !== window && scrollElem.parentElement !== null && captureElementFromTop) {
            var scrollElemBoundingRect = getBoundingClientContentRect(scrollElem);
            var targetWindowScrollY = Math.floor(scrollElemBoundingRect.top - safeArea.top);
            logger('performing window.scrollTo to scroll to container, coords: ' + window.scrollX + ', ' + targetWindowScrollY)
            window.scrollTo(window.scrollX, targetWindowScrollY); // TODO: (MOST LIKELY ALREADY DONE) scroll not to the top of the scroll element, but to the top of the safe area

            rect = getCaptureRect(captureElements, {
                // initialRect: rect,
                allowViewportOverflow: allowViewportOverflow,
                scrollElem: scrollElem,
                viewportWidth: viewportWidth,
                documentHeight: documentHeight
            }, logger);//.translate(0, window.scrollY);

            ignoreAreas = findIgnoreAreas(opts.ignoreSelectors, {
                scrollElem: scrollElem,
                pixelRatio: pixelRatio,
                viewportWidth: viewportWidth,
                documentHeight: documentHeight
            }, { x: 0, y: window.scrollY }, logger);

            safeArea = getSafeAreaRect(rect, captureElements, {
                scrollElem: scrollElem,
                viewportWidth: viewportWidth,
                viewportHeight: viewportHeight
            }, logger);
        }
        // Scroll so that capture area aligns with the top border of safeArea
        // So, we want to scroll
        // delta to scroll inside container = rect.top - scrollElement.top
        // scrollElement.top + delta = absolute cood of capture area (basicaly what we started from)
        // I think the most straightforward way is to do the following:
        // 1. Determine point to which we should scroll. To do that, we compare scrollElement rect (first we convert rect to viewport coords)
        //      and safeArea and pick smaller one.
        // 2. Convert that point back to absolute coords.
        // 3. rect.top minus that point is delta that we are looking for.
        var isScrollElemWindow = scrollElem === window || scrollElem.parentElement === null;

        // var safeAreaTopInPageCoords = safeArea.top + window.scrollY; // this is not the way.
        // logger('current window.scrollY: ' + window.scrollY + '; current safeAreaTopInPageCoords: ' + safeAreaTopInPageCoords);
        logger('current rect:', rect);

        // If we are scrolling window, we just need to scroll to element, taking safeArea into account.
        // If we are scrolling inside some container, we should take both safe area and existing window scroll offset into account.
        // Example: We have container at 1000px and target block inside it at 2000px (measured in global page coords).
        //          In the code above we scrolled window by 1000px to container.
        //          So now we only need to scroll by 1000px inside that container to our block, not by 2000px, because we already scrolled window by 1000px.
        var targetScrollY = Math.max(Math.floor(rect.top - (isScrollElemWindow ? safeArea.top : safeArea.top + window.scrollY)), 0); // This is the way.
        // var targetScrollY = Math.max(Math.floor(rect.top - safeAreaTopInPageCoords), 0);

        // var targetScrollX = scrollElem.scrollLeft;
        // var targetScrollY = (isScrollElemWindow ? window.scrollY : scrollElem.scrollTop) + Math.max(Math.floor(rect.top - safeAreaTopInPageCoords), 0);
        var targetScrollX = isScrollElemWindow ? window.scrollX : scrollElem.scrollLeft;

        logger("captureElementFromTop=true, performing scroll to capture area, coords: " + targetScrollY + ", " + targetScrollX);

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
        }, logger);//.translate(0, window.scrollY);

        ignoreAreas = findIgnoreAreas(opts.ignoreSelectors, {
            scrollElem: scrollElem,
            pixelRatio: pixelRatio,
            viewportWidth: viewportWidth,
            documentHeight: documentHeight
        }, { x: 0, y: window.scrollY }, logger);

        safeArea = getSafeAreaRect(rect, captureElements, {
            scrollElem: scrollElem,
            viewportWidth: viewportWidth,
            viewportHeight: viewportHeight
        }, logger);

        logger("scrollToCaptureAreaInSafari, rect:", rect);
    } else if (allowViewportOverflow && viewPort.rectIntersects(rect)) {
        rect.overflowsTopBound(viewPort) && rect.recalculateHeight(viewPort);
        rect.overflowsLeftBound(viewPort) && rect.recalculateWidth(viewPort);
    } else if (!captureElementFromTop && !allowViewportOverflow && !viewPort.rectIntersects(rect)) {
        return {
            error: "OUTSIDE_OF_VIEWPORT",
            message:
                "Can not capture element, because it is outside of viewport. " +
                'Try to set "captureElementFromTop=true" to scroll to it before capture' +
                ' or to set "allowViewportOverflow=true" to ignore viewport overflow error.'
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
        viewport: new Rect({
            left: util.getScrollLeft(scrollElem),
            top: util.getScrollTop(scrollElem),
            width: viewportWidth,
            height: viewportHeight
        })
            .scale(pixelRatio)
            .serialize(),
        safeArea: safeArea.scale(pixelRatio).serialize(),
        documentHeight: Math.ceil(documentHeight * pixelRatio),
        documentWidth: Math.ceil(documentWidth * pixelRatio),
        canHaveCaret: isEditable(document.activeElement),
        pixelRatio: pixelRatio,
        containerScrollY: scrollElem === window || scrollElem.parentElement === null ? 0 : Math.floor(util.getScrollTop(scrollElem) * pixelRatio),
        containerScrollX: scrollElem === window || scrollElem.parentElement === null ? 0 : Math.floor(util.getScrollLeft(scrollElem) * pixelRatio),
        windowScrollY: Math.floor(window.scrollY * pixelRatio),
        windowScrollX: Math.floor(window.scrollX * pixelRatio),
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

    // Build z-index chains for all capture elements
    var targetChains = captureElements.map(function (el) {
        return _buildZChain(el);
    });
    logger('target element z chain');
    targetChains[0].forEach(function (chainEl) {
        logger('  iterating over targetChains[0]. Classlist: ' + (chainEl.ctx.classList ? chainEl.ctx.classList.toString() : 'unknown') + '; z: ' + chainEl.z);
    })

    // 2. Detect interfering elements heuristically
    var root = document.documentElement;
    var allElements = root.querySelectorAll ? root.querySelectorAll("*") : [];

    var interferingRects = [];
    
    allElements.forEach(function (el) {
        logger('getSafeAreaRect(), processing potentially interfering element: ' + el.classList.toString());
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

            var scrollParent = getScrollParent(el, logger);
            if (scrollParent && typeof scrollParent.getBoundingClientRect === 'function') {
                var scrollParentBr = scrollParent.getBoundingClientRect();
                topValue += scrollParentBr.top;
                bottomValue += scrollParentBr.bottom;
            }

            // TODO: determine which element this element sticks to
            
            // Create interference rect based on sticky positioning
            if (!isNaN(topValue)) {
                // Sticky to top - interferes from viewport top + topValue
                br = {
                    left: br.left,
                    top: topValue,
                    // right: br.right,
                    // bottom: topValue + br.height,
                    width: br.width,
                    height: br.height
                };
                shouldInterfere = true;
                logger('  it is sticky to top! bounding rect: ' + JSON.stringify(br));
            } else if (!isNaN(bottomValue)) {
                // Sticky to bottom - interferes from viewport bottom - bottomValue - height
                var viewportBottom = (scrollElem === window) ? viewportHeight : safeArea.top + safeArea.height;
                br = {
                    left: br.left,
                    top: viewportBottom - bottomValue - br.height,
                    // right: br.right,
                    // bottom: viewportBottom - bottomValue,
                    width: br.width,
                    height: br.height
                };
                shouldInterfere = true;
            }
        }
        
        logger('  likely interferes: ' + shouldInterfere);

        if (shouldInterfere) {
            var candChain = _buildZChain(el);
            logger('  candidate z chain', Array.from(candChain.entries()));
            logger('  candidate z chain ctx', candChain[0].ctx);
            logger('  candidate z chain is ctx documentElement?: ' + (candChain[0].ctx === document.documentElement));
            var behindAll = targetChains.every(function (tChain) {
                return _isChainBehind(candChain, tChain);
            });

            if (!behindAll) {
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
        logger('getElementCaptureRect result:', elementRect);
        if (elementRect) {
            rect = rect ? rect.merge(elementRect) : elementRect;
        }
    }

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

function findIgnoreAreas(selectors, opts, offset, logger) {
    var result = [];
    util.each(selectors, function (selector) {
        var elements = queryIgnoreAreas(selector);

        util.each(elements, function (elem) {
            var ignoreArea = addIgnoreArea.call(result, elem, opts, logger);
            // if (ignoreArea) {
            //     return ignoreArea.translate(0, offset.y);
            // }
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
    logger('getAbsoluteClientRect result: ', clientRect);

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

function _buildZChain(element) {
    var chain = [];
    var curr = element;
    while (curr && curr !== document.documentElement) {
        var ctx = _getStackingContextRoot(curr);
        var z = _getEffectiveZIndex(curr);
        chain.unshift({ ctx: ctx, z: z });
        if (ctx === document.documentElement) {
            break;
        }
        curr = ctx;
    }
    return chain;
}

function _isChainBehind(candChain, targetChain) {
    // Algorithm:
    // 1. Find the closest common stacking context between two chains
    // var len = Math.min(candChain.length, targetChain.length);
    for (var j = targetChain.length - 1; j >= 0; j--) {
        for (var i = candChain.length - 1; i >= 0; i--) {
            if (candChain[i].ctx === targetChain[j].ctx) {
                return candChain[i].z < targetChain[j].z;
            }
        }
    }
    //     if (candChain[i].ctx !== targetChain[i].ctx) {
    //         // diverged before common ctx – can't be sure, treat as overlapping
    //         return false;
    //     }
    //     if (candChain[i].z !== targetChain[i].z) {
    //         return candChain[i].z < targetChain[i].z;
    //     }
    // }

    // chains identical so far, treat as overlapping
    return false;
}
