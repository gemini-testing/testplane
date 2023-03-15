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

function prepareScreenshotUnsafe(areas, opts) {
    var allowViewportOverflow = opts.allowViewportOverflow;
    var captureElementFromTop = opts.captureElementFromTop;
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
    }

    var rect,
        selectors = [];

    areas.forEach(function (area) {
        if (Rect.isRect(area)) {
            rect = rect ? rect.merge(new Rect(area)) : new Rect(area);
        } else {
            selectors.push(area);
        }
    });

    rect = getCaptureRect(selectors, { allowViewportOverflow: allowViewportOverflow, scrollElem: scrollElem }, rect);

    if (rect.error) {
        return rect;
    }

    var viewportWidth = document.documentElement.clientWidth,
        viewportHeight = document.documentElement.clientHeight,
        documentWidth = document.documentElement.scrollWidth,
        documentHeight = document.documentElement.scrollHeight,
        viewPort = new Rect({
            left: util.getScrollLeft(scrollElem),
            top: util.getScrollTop(scrollElem),
            width: viewportWidth,
            height: viewportHeight
        }),
        pixelRatio = configurePixelRatio(opts.usePixelRatio);

    if (captureElementFromTop && !viewPort.rectInside(rect)) {
        util.isSafariMobile()
            ? scrollToCaptureAreaInSafari(viewPort, rect, scrollElem)
            : scrollElem.scrollTo(rect.left, rect.top);
    } else if (allowViewportOverflow && viewPort.rectIntersects(rect)) {
        rect.overflowsTopBound(viewPort) && rect.recalculateHeight(viewPort);
        rect.overflowsLeftBound(viewPort) && rect.recalculateWidth(viewPort);
    } else if (!captureElementFromTop && !viewPort.rectIntersects(rect)) {
        return {
            error: "OUTSIDE_OF_VIEWPORT",
            message:
                "Can not capture element, because it is outside of viewport. " +
                'Try to set "captureElementFromTop=true" to scroll to it before capture.'
        };
    }

    return {
        captureArea: rect.serialize(),
        ignoreAreas: findIgnoreAreas(opts.ignoreSelectors, scrollElem),
        viewport: {
            left: util.getScrollLeft(scrollElem),
            top: util.getScrollTop(scrollElem),
            width: Math.round(viewportWidth),
            height: Math.round(viewportHeight)
        },
        documentHeight: Math.round(documentHeight),
        documentWidth: Math.round(documentWidth),
        canHaveCaret: isEditable(document.activeElement),
        pixelRatio: pixelRatio
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

function getCaptureRect(selectors, opts, initialRect) {
    var element,
        elementRect,
        rect = initialRect;
    for (var i = 0; i < selectors.length; i++) {
        element = lib.queryFirst(selectors[i]);
        if (!element) {
            return {
                error: "NOTFOUND",
                message: "Could not find element with css selector specified in setCaptureElements: " + selectors[i],
                selector: selectors[i]
            };
        }

        elementRect = getElementCaptureRect(element, opts);
        if (elementRect) {
            rect = rect ? rect.merge(elementRect) : elementRect;
        }
    }

    return rect
        ? rect.round()
        : {
              error: "HIDDEN",
              message: "Area with css selector : " + selectors + " is hidden",
              selector: selectors
          };
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

function findIgnoreAreas(selectors, scrollElem) {
    var result = [];
    util.each(selectors, function (selector) {
        var elements = queryIgnoreAreas(selector);

        util.each(elements, function (elem) {
            return addIgnoreArea.call(result, elem, scrollElem);
        });
    });

    return result;
}

function addIgnoreArea(element, scrollElem) {
    var rect = element && getElementCaptureRect(element, { scrollElem: scrollElem });
    rect && this.push(rect.round().serialize());
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
        clientRect = rect.getAbsoluteClientRect(element, opts.scrollElem);

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
    var documentHeight = Math.round(document.documentElement.scrollHeight);
    var viewportHeight = Math.round(document.documentElement.clientHeight);
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
