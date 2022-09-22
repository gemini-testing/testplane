/*jshint browserify:true*/
import {queryIgnoreAreas} from './ignore-areas';
import Rect, {getAbsoluteClientRect} from './rect';
import * as util from './util';

import type * as libTyping from './lib.native';
import type {Page} from '../../types/page';
import type {SerializedRect} from '../../types/rect';

const lib: typeof libTyping = require('./lib');

if (typeof window === 'undefined') {
    //@ts-ignore
    global.__geminiCore = exports;
} else {
    //@ts-ignore
    window.__geminiCore = exports;
}

export const queryFirst = lib.queryFirst;

type PrepareScreenshotOpts = {
    ignoreSelectors: Array<string>;
    allowViewportOverflow?: boolean;
    captureElementFromTop?: boolean;
    selectorToScroll?: string;
    usePixelRatio?: boolean;
    coverage?: boolean;
};

type RectError = {
    error: string;
    message: string;
    selector?: string | Array<string>;
};

// Terminology
// - clientRect - the result of calling getBoundingClientRect of the element
// - extRect - clientRect + outline + box shadow
// - elementCaptureRect - sum of extRects of the element and its pseudo-elements
// - captureRect - sum of all elementCaptureRect for each captureSelectors

export function prepareScreenshot(areas: Array<string | Rect>, opts: PrepareScreenshotOpts = {ignoreSelectors: []}): Page | RectError {
    try {
        return prepareScreenshotUnsafe(areas, opts);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.stack || e.message : e as string;

        return {
            error: 'JS',
            message
        };
    }
}

function prepareScreenshotUnsafe(areas: Array<string | Rect>, opts: PrepareScreenshotOpts): Page | RectError {
    const {allowViewportOverflow, captureElementFromTop} = opts;
    let scrollElem: Element | Window = window;

    if (opts.selectorToScroll) {
        scrollElem = document.querySelector(opts.selectorToScroll) as Element;

        if (!scrollElem) {
            return {
                error: 'NOTFOUND',
                message: 'Could not find element with css selector specified in "selectorToScroll" option: ' + opts.selectorToScroll,
                selector: opts.selectorToScroll
            };
        }
    }

    let initialRect: Rect | null = null;
    const selectors: Array<string> = [];

    areas.forEach((area) => {
        if (Rect.isRect(area)) {
            initialRect = initialRect ? initialRect.merge(new Rect(area)) : new Rect(area);
        } else {
            selectors.push(area);
        }
    });

    const rect = getCaptureRect(selectors, {allowViewportOverflow, scrollElem}, initialRect);

    if (isRectError(rect)) {
        return rect;
    }

    let coverage;
    const viewportHeight = document.documentElement.clientHeight,
        viewportWidth = document.documentElement.clientWidth,
        documentHeight = document.documentElement.scrollHeight,
        documentWidth = document.documentElement.scrollWidth,
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

function isRectError(obj: Rect | RectError): obj is RectError {
    return Boolean((obj as RectError).error);
}

export function resetZoom(): void {
    let meta = lib.queryFirst('meta[name="viewport"]');

    if (!meta) {
        meta = document.createElement('meta');
        (meta as any).name = 'viewport';
        const head = lib.queryFirst('head');
        head && head.appendChild(meta);
    }
    (meta as any).content = 'width=device-width,initial-scale=1.0,user-scalable=no';
}

type GetCaptureRectOpts = {
    allowViewportOverflow?: boolean;
    scrollElem: Element | Window;
};

function getCaptureRect(selectors: Array<string>, opts: GetCaptureRectOpts, initialRect: Rect | null): Rect | RectError {
    let element: Element | null;
    let elementRect: Rect | null;
    let rect: Rect | null = initialRect;

    for (let i = 0; i < selectors.length; i++) {
        element = lib.queryFirst(selectors[i]) as Element | null;

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

function configurePixelRatio(usePixelRatio?: boolean): number {
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

function findIgnoreAreas(selectors: Array<string>, scrollElem: Element | Window) {
    const result: Array<SerializedRect> = [];
    util.each(selectors, function(selector) {
        const elements = queryIgnoreAreas(selector) as Array<Element>;

        util.each(elements, function(elem) {
            return addIgnoreArea.call(result, elem, scrollElem);
        });
    });

    return result;
}

function addIgnoreArea(this: Array<SerializedRect>, element: Element | null, scrollElem: Element | Window) {
    const rect = element && getElementCaptureRect(element, {scrollElem: scrollElem});
    rect && this.push(rect.round().serialize());
}

function isHidden(css: CSSStyleDeclaration, clientRect: Rect): boolean {
    return css.display === 'none' ||
        css.visibility === 'hidden' ||
        +css.opacity < 0.0001 ||
        clientRect.width < 0.0001 ||
        clientRect.height < 0.0001;
}

function getElementCaptureRect(element: Element, opts: GetCaptureRectOpts): Rect | null {
    const pseudo = [':before', ':after'];
    let css = lib.getComputedStyle(element);
    const clientRect = getAbsoluteClientRect(element, opts.scrollElem);

    if (isHidden(css, clientRect)) {
        return null;
    }

    let elementRect = getExtRect(css, clientRect, opts.allowViewportOverflow);

    util.each(pseudo, function(pseudoEl) {
        css = lib.getComputedStyle(element, pseudoEl);
        elementRect = elementRect.merge(getExtRect(css, clientRect, opts.allowViewportOverflow));
    });

    return elementRect;
}

function getExtRect(css: CSSStyleDeclaration, clientRect: Rect, allowViewportOverflow?: boolean): Rect {
    const shadows = parseBoxShadow(css.boxShadow);
    let outline = parseInt(css.outlineWidth, 10);

    if (isNaN(outline)) {
        outline = 0;
    }

    return adjustRect(clientRect, shadows, outline, allowViewportOverflow);
}

type BoxShadow = {
    offsetX: number;
    offsetY: number;
    blurRadius: number;
    spreadRadius: number;
    inset: boolean;
};

function parseBoxShadow(value = ''): Array<BoxShadow> {
    const regex = /[-+]?\d*\.?\d+px/g;
    const values = value.split(',');
    const results: Array<BoxShadow> = [];

    let match: RegExpMatchArray | null;

    util.each(values, function(value) {
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

function adjustRect(rect: Rect, shadows: Array<BoxShadow>, outline: number, allowViewportOverflow?: boolean): Rect {
    const shadowRect = calculateShadowRect(rect, shadows, allowViewportOverflow);
    const outlineRect = calculateOutlineRect(rect, outline, allowViewportOverflow);

    return shadowRect.merge(outlineRect);
}

function calculateOutlineRect(rect: Rect, outline: number, allowViewportOverflow?: boolean): Rect {
    const top = rect.top - outline;
    const left = rect.left - outline;

    return new Rect({
        top: allowViewportOverflow ? top : Math.max(0, top),
        left: allowViewportOverflow ? left : Math.max(0, left),
        bottom: rect.bottom + outline,
        right: rect.right + outline
    });
}

function calculateShadowRect(rect: Rect, shadows: Array<BoxShadow>, allowViewportOverflow?: boolean): Rect {
    const extent = calculateShadowExtent(shadows);
    const left = rect.left + extent.left;
    const top = rect.top + extent.top;

    return new Rect({
        left: allowViewportOverflow ? left : Math.max(0, left),
        top: allowViewportOverflow ? top : Math.max(0, top),
        width: rect.width - extent.left + extent.right,
        height: rect.height - extent.top + extent.bottom
    });
}

function calculateShadowExtent(shadows: Array<BoxShadow>) {
    const result = {top: 0, left: 0, right: 0, bottom: 0};

    util.each(shadows, function(shadow) {
        if (shadow.inset) {
            //skip inset shadows
            return;
        }

        const blurAndSpread = shadow.spreadRadius + shadow.blurRadius;

        result.left = Math.min(shadow.offsetX - blurAndSpread, result.left);
        result.right = Math.max(shadow.offsetX + blurAndSpread, result.right);
        result.top = Math.min(shadow.offsetY - blurAndSpread, result.top);
        result.bottom = Math.max(shadow.offsetY + blurAndSpread, result.bottom);
    });

    return result;
}

function isEditable(element: Element | null): boolean {
    if (!element) {
        return false;
    }

    return /^(input|textarea)$/i.test(element.tagName) ||
        (element as HTMLElement).isContentEditable;
}

function scrollToCaptureAreaInSafari(viewportCurr: Rect, captureArea: Rect, scrollElem: Element | Window): void {
    const documentHeight = Math.round(document.documentElement.scrollHeight);
    const viewportHeight = Math.round(document.documentElement.clientHeight);
    const maxScrollByY = documentHeight - viewportHeight;

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
