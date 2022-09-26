"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
exports.__esModule = true;
exports.resetZoom = exports.prepareScreenshot = exports.queryFirst = void 0;
/*jshint browserify:true*/
var ignore_areas_1 = require("./ignore-areas");
var rect_1 = __importStar(require("./rect"));
var util = __importStar(require("./util"));
var lib = require('./lib');
if (typeof window === 'undefined') {
    //@ts-ignore
    global.__geminiCore = exports;
}
else {
    //@ts-ignore
    window.__geminiCore = exports;
}
exports.queryFirst = lib.queryFirst;
// Terminology
// - clientRect - the result of calling getBoundingClientRect of the element
// - extRect - clientRect + outline + box shadow
// - elementCaptureRect - sum of extRects of the element and its pseudo-elements
// - captureRect - sum of all elementCaptureRect for each captureSelectors
function prepareScreenshot(areas, opts) {
    if (opts === void 0) { opts = { ignoreSelectors: [] }; }
    try {
        return prepareScreenshotUnsafe(areas, opts);
    }
    catch (e) {
        var message = e instanceof Error ? e.stack || e.message : e;
        return {
            error: 'JS',
            message: message
        };
    }
}
exports.prepareScreenshot = prepareScreenshot;
function prepareScreenshotUnsafe(areas, opts) {
    var allowViewportOverflow = opts.allowViewportOverflow, captureElementFromTop = opts.captureElementFromTop;
    var scrollElem = window;
    if (opts.selectorToScroll) {
        scrollElem = document.querySelector(opts.selectorToScroll);
        if (!scrollElem) {
            return {
                error: 'NOTFOUND',
                message: 'Could not find element with css selector specified in "selectorToScroll" option: ' + opts.selectorToScroll,
                selector: opts.selectorToScroll
            };
        }
    }
    var initialRect = null;
    var selectors = [];
    areas.forEach(function (area) {
        if (rect_1["default"].isRect(area)) {
            initialRect = initialRect ? initialRect.merge(new rect_1["default"](area)) : new rect_1["default"](area);
        }
        else {
            selectors.push(area);
        }
    });
    var rect = getCaptureRect(selectors, { allowViewportOverflow: allowViewportOverflow, scrollElem: scrollElem }, initialRect);
    if (isRectError(rect)) {
        return rect;
    }
    var coverage;
    var viewportHeight = document.documentElement.clientHeight, viewportWidth = document.documentElement.clientWidth, documentHeight = document.documentElement.scrollHeight, documentWidth = document.documentElement.scrollWidth, viewPort = new rect_1["default"]({
        left: util.getScrollLeft(scrollElem),
        top: util.getScrollTop(scrollElem),
        width: viewportWidth,
        height: viewportHeight
    }), pixelRatio = configurePixelRatio(opts.usePixelRatio);
    if (captureElementFromTop && !viewPort.rectInside(rect)) {
        util.isSafariMobile()
            ? scrollToCaptureAreaInSafari(viewPort, rect, scrollElem)
            : scrollElem.scrollTo(rect.left, rect.top);
    }
    else if (allowViewportOverflow && viewPort.rectIntersects(rect)) {
        rect.overflowsTopBound(viewPort) && rect.recalculateHeight(viewPort);
        rect.overflowsLeftBound(viewPort) && rect.recalculateWidth(viewPort);
    }
    else if (!captureElementFromTop && !viewPort.rectIntersects(rect)) {
        return {
            error: 'OUTSIDE_OF_VIEWPORT',
            message: 'Can not capture element, because it is outside of viewport. ' +
                'Try to set "captureElementFromTop=true" to scroll to it before capture.'
        };
    }
    if (opts.coverage) {
        coverage = require('./index.coverage').collectCoverage(rect);
    }
    return {
        captureArea: rect.serialize(),
        ignoreAreas: findIgnoreAreas(opts.ignoreSelectors, scrollElem),
        viewport: {
            top: util.getScrollTop(scrollElem),
            left: util.getScrollLeft(scrollElem),
            width: Math.round(viewportWidth),
            height: Math.round(viewportHeight)
        },
        documentHeight: Math.round(documentHeight),
        documentWidth: Math.round(documentWidth),
        coverage: coverage,
        canHaveCaret: isEditable(document.activeElement),
        pixelRatio: pixelRatio
    };
}
function isRectError(obj) {
    return Boolean(obj.error);
}
function resetZoom() {
    var meta = lib.queryFirst('meta[name="viewport"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'viewport';
        var head = lib.queryFirst('head');
        head && head.appendChild(meta);
    }
    meta.content = 'width=device-width,initial-scale=1.0,user-scalable=no';
}
exports.resetZoom = resetZoom;
function getCaptureRect(selectors, opts, initialRect) {
    var element;
    var elementRect;
    var rect = initialRect;
    for (var i = 0; i < selectors.length; i++) {
        element = lib.queryFirst(selectors[i]);
        if (!element) {
            return {
                error: 'NOTFOUND',
                message: 'Could not find element with css selector specified in setCaptureElements: ' + selectors[i],
                selector: selectors[i]
            };
        }
        elementRect = getElementCaptureRect(element, opts);
        if (elementRect) {
            rect = rect ? rect.merge(elementRect) : elementRect;
        }
    }
    return rect ? rect.round() : {
        error: 'HIDDEN',
        message: 'Area with css selector : ' + selectors + ' is hidden',
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
    //@ts-expect-error
    return window.screen.deviceXDPI / window.screen.logicalXDPI || 1;
}
function findIgnoreAreas(selectors, scrollElem) {
    var result = [];
    util.each(selectors, function (selector) {
        var elements = (0, ignore_areas_1.queryIgnoreAreas)(selector);
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
    return css.display === 'none' ||
        css.visibility === 'hidden' ||
        +css.opacity < 0.0001 ||
        clientRect.width < 0.0001 ||
        clientRect.height < 0.0001;
}
function getElementCaptureRect(element, opts) {
    var pseudo = [':before', ':after'];
    var css = lib.getComputedStyle(element);
    var clientRect = (0, rect_1.getAbsoluteClientRect)(element, opts.scrollElem);
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
    var shadows = parseBoxShadow(css.boxShadow);
    var outline = parseInt(css.outlineWidth, 10);
    if (isNaN(outline)) {
        outline = 0;
    }
    return adjustRect(clientRect, shadows, outline, allowViewportOverflow);
}
function parseBoxShadow(value) {
    if (value === void 0) { value = ''; }
    var regex = /[-+]?\d*\.?\d+px/g;
    var values = value.split(',');
    var results = [];
    var match;
    util.each(values, function (value) {
        if ((match = value.match(regex))) {
            results.push({
                offsetX: parseFloat(match[0]),
                offsetY: parseFloat(match[1]) || 0,
                blurRadius: parseFloat(match[2]) || 0,
                spreadRadius: parseFloat(match[3]) || 0,
                inset: value.indexOf('inset') !== -1
            });
        }
    });
    return results;
}
function adjustRect(rect, shadows, outline, allowViewportOverflow) {
    var shadowRect = calculateShadowRect(rect, shadows, allowViewportOverflow);
    var outlineRect = calculateOutlineRect(rect, outline, allowViewportOverflow);
    return shadowRect.merge(outlineRect);
}
function calculateOutlineRect(rect, outline, allowViewportOverflow) {
    var top = rect.top - outline;
    var left = rect.left - outline;
    return new rect_1["default"]({
        top: allowViewportOverflow ? top : Math.max(0, top),
        left: allowViewportOverflow ? left : Math.max(0, left),
        bottom: rect.bottom + outline,
        right: rect.right + outline
    });
}
function calculateShadowRect(rect, shadows, allowViewportOverflow) {
    var extent = calculateShadowExtent(shadows);
    var left = rect.left + extent.left;
    var top = rect.top + extent.top;
    return new rect_1["default"]({
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
    return /^(input|textarea)$/i.test(element.tagName) ||
        element.isContentEditable;
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
