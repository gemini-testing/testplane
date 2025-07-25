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

function prepareScreenshotUnsafe(areas, opts) {
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
            left: util.getScrollLeft(scrollElem),
            top: util.getScrollTop(scrollElem),
            width: viewportWidth,
            height: viewportHeight
        }),
        pixelRatio = configurePixelRatio(opts.usePixelRatio),
        rect,
        selectors = [];

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
    });
    console.log("getCaptureRect, rect:", rect);

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
    })

    var safeArea = getSafeAreaRect(rect, captureElements, {
        scrollElem: scrollElem,
        viewportWidth: viewportWidth,
        viewportHeight: viewportHeight
    });

    if (captureElementFromTop && !viewPort.rectInside(rect)) {
        if (opts.selectorToScroll && captureElementFromTop) {
            var scrollElemBoundingRect = getBoundingClientContentRect(scrollElem);
            window.scrollTo(window.scrollX, scrollElemBoundingRect.top); // TODO: scroll not to the top of the scroll element, but to the top of the safe area

            // Transform capture area to scroll element coordinates
            // rect.top = rect.top - window.scrollY;
            // rect.bottom = rect.bottom - window.scrollY;
            // rect.left = rect.left - window.scrollX;
            // rect.right = rect.right - window.scrollX;

            safeArea = getSafeAreaRect(rect, captureElements, {
                scrollElem: scrollElem,
                viewportWidth: viewportWidth,
                viewportHeight: viewportHeight
            })
        }
        // Scroll so that capture area aligns with the top border of safeArea
        var targetScrollY = Math.max(rect.top - (scrollElemBoundingRect || {}).top - safeArea.top, 0); // TODO: this is most likely wrong, because rect is in global coordinates, but safeArea is in viewport coordinates
        // By how much should we scroll inside container so that target element is aligned with the top border of safeArea?
        // - How do we compute 
        var targetScrollX = scrollElem.offsetLeft;

        if (util.isSafariMobile()) {
            scrollToCaptureAreaInSafari(viewPort, new Rect({ left: rect.left, top: targetScrollY, width: rect.width, height: rect.height }), scrollElem);
        } else {
            scrollElem.scrollTo(targetScrollX, targetScrollY);
        }

        console.log("scrollToCaptureAreaInSafari, rect:", rect);
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

    console.log("prepareScreenshotUnsafe, rect:", rect);
    console.log("prepareScreenshotUnsafe, pixelRatio:", pixelRatio);

    return {
        captureArea: rect.scale(pixelRatio).serialize(),
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
        containerScrollY: scrollElem === window ? 0 : Math.floor(util.getScrollTop(scrollElem) * pixelRatio),
        containerScrollX: scrollElem === window ? 0 : Math.floor(util.getScrollLeft(scrollElem) * pixelRatio),
        windowScrollY: Math.floor(window.scrollY) * pixelRatio,
        windowScrollX: Math.floor(window.scrollX) * pixelRatio
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

function getSafeAreaRect(captureArea, captureElements, opts) {
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

    // 2. Detect sticky elements dynamically by comparing their positions before and after scroll
    var root = document.documentElement; // scrollElem === window ? document.documentElement : scrollElem;
    var allElements = root.querySelectorAll ? root.querySelectorAll("*") : [];

    // a) snapshot initial positions of candidate elements (visible, horizontally intersecting capture area, not inside capture elements)
    var candidates = [];
    allElements.forEach(function (el) {
        if (util.some(captureElements, function (capEl) { return capEl.contains(el) || el.contains(capEl); })) {
            return;
        }

        var br0 = el.getBoundingClientRect();
        if (br0.width < 1 || br0.height < 1) {
            return;
        }

        if (br0.right <= captureAreaInViewportCoords.left || br0.left >= captureAreaInViewportCoords.right) {
            return;
        }

        candidates.push({ el: el, top0: br0.top, rect0: br0 });
    });

    // b) try scrolling the container by 50px
    var initialScrollTop = util.getScrollTop(scrollElem);
    var scrollStep = 50;

    if (scrollElem === window) {
        scrollElem.scrollTo(util.getScrollLeft(scrollElem), initialScrollTop + scrollStep);
    } else {
        scrollElem.scrollTop = initialScrollTop + scrollStep;
    }

    var newScrollTop = util.getScrollTop(scrollElem);

    // If container did not scroll – abort and return original safe area
    if (newScrollTop === initialScrollTop) {
        return originalSafeArea;
    }

    console.log("getSafeAreaRect, candidates:", candidates);

    // c) detect sticky elements – those whose top didn't change after scroll
    var stickyRects = [];
    candidates.forEach(function (item) {
        var br1 = item.el.getBoundingClientRect();
        if (Math.abs(br1.top - item.top0) < 1) { // consider unchanged
            stickyRects.push(br1);
        }
    });

    console.log("getSafeAreaRect, stickyRects:", stickyRects);

    // d) restore scroll position
    if (scrollElem === window) {
        scrollElem.scrollTo(util.getScrollLeft(scrollElem), initialScrollTop);
    } else {
        scrollElem.scrollTop = initialScrollTop;
    }

    // e) shrink safe area according to sticky elements
    stickyRects.forEach(function (br) {
        console.log("getSafeAreaRect, stickyRects, br:", br);
        var safeAreaBottom = safeArea.top + safeArea.height;
        var captureBottom = captureAreaInViewportCoords.top + captureAreaInViewportCoords.height;

        // if (br.bottom <= captureAreaInViewportCoords.top) {
        //     console.log("getSafeAreaRect, stickyRects, br.bottom <= captureAreaInViewportCoords.top");

        //     // Sticky element is above capture area – shrink from top only
        //     safeArea.top = Math.max(safeArea.top, br.bottom);
        //     safeArea.height = safeAreaBottom - safeArea.top;
        //     safeArea.bottom = safeArea.top + safeArea.height;

        //     console.log("getSafeAreaRect, safeArea.top:", safeArea.top);
        //     console.log("getSafeAreaRect, safeArea.height:", safeArea.height);
        //     console.log("getSafeAreaRect, safeArea.bottom:", safeArea.bottom);
        // } else if (br.top >= captureBottom) {
        //     console.log("getSafeAreaRect, stickyRects, br.top >= captureBottom");
            
        //     // Sticky element is below capture area – shrink from bottom only
        //     safeArea.height = Math.min(safeArea.height, br.top - safeArea.top);
        //     safeArea.bottom = safeArea.top + safeArea.height;
        // } else {
            console.log("getSafeAreaRect, stickyRects, else");
            
            // Sticky element overlaps capture area vertically – choose side with smaller shrink
            var shrinkTop = br.bottom - safeArea.top;
            var shrinkBottom = safeAreaBottom - br.top;

            console.log("getSafeAreaRect, shrinkTop:", shrinkTop);
            console.log("getSafeAreaRect, shrinkBottom:", shrinkBottom);

            if (shrinkTop < shrinkBottom) {
                safeArea.top = Math.max(safeArea.top, br.bottom);
                safeArea.height = safeAreaBottom - safeArea.top;
                safeArea.bottom = safeArea.top + safeArea.height;
            } else {
                safeArea.height = Math.min(safeArea.height, br.top - safeArea.top);
                safeArea.bottom = safeArea.top + safeArea.height;
            }
        // }
    });

    console.log("getSafeAreaRect, result safeArea:", safeArea);
    console.log("getSafeAreaRect, result originalSafeArea:", originalSafeArea);

    // 5. Ensure we didn't shrink more than 50 % of original height
    if (safeArea.height < originalSafeArea.height / 2) {
        safeArea.top = originalSafeArea.top;
        safeArea.height = originalSafeArea.height;
    }

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

function getCaptureRect(captureElements, opts) {
    var element,
        elementRect,
        rect = opts.initialRect;
    for (var i = 0; i < captureElements.length; i++) {
        element = captureElements[i];

        elementRect = getElementCaptureRect(element, opts);
        if (elementRect) {
            rect = rect ? rect.merge(elementRect) : elementRect;
        }
    }

    return rect
        ? rect.round()
        : null;
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

function findIgnoreAreas(selectors, opts) {
    var result = [];
    util.each(selectors, function (selector) {
        var elements = queryIgnoreAreas(selector);

        util.each(elements, function (elem) {
            return addIgnoreArea.call(result, elem, opts);
        });
    });

    return result;
}

function addIgnoreArea(element, opts) {
    var rect = element && getElementCaptureRect(element, opts);

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

function getElementCaptureRect(element, opts) {
    var pseudo = [":before", ":after"],
        css = lib.getComputedStyle(element),
        clientRect = rect.getAbsoluteClientRect(element, opts);

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
