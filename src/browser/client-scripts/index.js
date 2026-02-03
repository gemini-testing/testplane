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

    rect = getCaptureRect(selectors, {
        initialRect: rect,
        allowViewportOverflow: allowViewportOverflow,
        scrollElem: scrollElem,
        viewportWidth: viewportWidth,
        documentHeight: documentHeight
    });

    if (rect.error) {
        return rect;
    }

    if (captureElementFromTop && !viewPort.rectInside(rect)) {
        util.isSafariMobile()
            ? scrollToCaptureAreaInSafari(viewPort, rect, scrollElem)
            : scrollElem.scrollTo(rect.left, rect.top);
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

    return {
        captureArea: rect.scale(pixelRatio).serialize(),
        ignoreAreas: findIgnoreAreas(opts.ignoreSelectors, {
            scrollElem: scrollElem,
            pixelRatio: pixelRatio,
            viewportWidth: viewportWidth,
            documentHeight: documentHeight
        }),
        viewport: new Rect({
            left: util.getScrollLeft(scrollElem),
            top: util.getScrollTop(scrollElem),
            width: viewportWidth,
            height: viewportHeight
        })
            .scale(pixelRatio)
            .serialize(),
        documentHeight: Math.ceil(documentHeight * pixelRatio),
        documentWidth: Math.ceil(documentWidth * pixelRatio),
        canHaveCaret: isEditable(document.activeElement),
        pixelRatio: pixelRatio
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

function getCaptureRect(selectors, opts) {
    var element,
        elementRect,
        rect = opts.initialRect;
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
        outlineWidth = parseInt(css.outlineWidth, 10),
        outlineStyle = css.outlineStyle;

    if (isNaN(outlineWidth) || outlineStyle === "none") {
        outlineWidth = 0;
    }

    return adjustRect(clientRect, shadows, outlineWidth, allowViewportOverflow);
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
