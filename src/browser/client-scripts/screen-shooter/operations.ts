import {
    Coord,
    Length,
    Rect,
    fromBcrToRect,
    getBottom,
    getCoveringRect,
    getHeight,
    getIntersection
} from "@isomorphic";
import { OutsideOfViewportError } from "./errors/outside-of-viewport";
import {
    ComputeCanHaveCaretResult,
    ComputeDocumentSizeResult,
    ComputeCaptureSpecsResult,
    ComputeIgnoreAreasResult,
    ComputePixelRatioResult,
    ComputeSafeAreaResult,
    ComputeViewportOffsetResult,
    ComputeViewportSizeResult,
    SavedScrollPosition as ElementScrollPosition,
    ScrollToCaptureSpecResult
} from "./types";
import { getReadableElementDescriptor } from "./utils/descriptions";
import {
    findContainingBlock,
    findFixedPositionedParent,
    forEachRoot,
    getMainDocumentElem,
    getScreenshooterNamespaceData
} from "./utils/dom";
import {
    domRectToViewportCss,
    getBoundingClientContentRect,
    getElementCaptureRect,
    getExtRect,
    getPseudoElementCaptureRect,
    getVerticalRadiusInsets
} from "./utils/element-rect";
import { getClipRect } from "./utils/clip-rect";
import {
    getCommonScrollParent,
    getScrollParent,
    getScrollParentsChain,
    isRootLikeElement,
    performScrollFixForSafariIfNeeded,
    scrollElementBy
} from "./utils/scroll";
import { createDefaultTrustedTypesPolicy } from "./utils/trusted-types";
import { buildZChain, isChainBehind } from "./utils/z-index";
import { parseCaptureSelector, PseudoElementSelector } from "./utils/pseudo-element-rect";
import { isSafariMobile } from "./utils/user-agent";

export function computeScrollOffset(element: Element): Coord<"page", "css", "y"> {
    return (isRootLikeElement(element) ? window.scrollY : element.scrollTop) as Coord<"page", "css", "y">;
}

export function computeViewportSize(): ComputeViewportSizeResult {
    return {
        viewportSize: {
            width: window.innerWidth as Length<"css", "x">,
            height: window.innerHeight as Length<"css", "y">
        }
    };
}

export function computeViewportOffset(): ComputeViewportOffsetResult {
    return {
        viewportOffset: {
            left: window.scrollX as Coord<"page", "css", "x">,
            top: window.scrollY as Coord<"page", "css", "y">
        }
    };
}

const ELEMENT_POSITIONS_PROBE_GRID_SIZE = 5;

function getProbeAxisCoordinates(length: number, gridSize: number): number[] {
    const safeLength = Math.max(1, Math.floor(length));
    if (gridSize <= 1) {
        return [0];
    }

    const maxCoord = safeLength - 1;
    const step = safeLength / (gridSize - 1);
    const coordinates: number[] = [];

    for (let i = 0; i < gridSize; i++) {
        coordinates.push(Math.min(maxCoord, Math.round(i * step)));
    }

    return coordinates;
}

export function computeElementPositionsProbe(
    gridSize = ELEMENT_POSITIONS_PROBE_GRID_SIZE
): Array<Rect<"viewport", "css"> | null> {
    const viewportSize = computeViewportSize().viewportSize;
    const xCoordinates = getProbeAxisCoordinates(viewportSize.width as number, gridSize);
    const yCoordinates = getProbeAxisCoordinates(viewportSize.height as number, gridSize);
    const probe: Array<Rect<"viewport", "css"> | null> = [];

    for (let yIndex = 0; yIndex < yCoordinates.length; yIndex++) {
        for (let xIndex = 0; xIndex < xCoordinates.length; xIndex++) {
            const x = xCoordinates[xIndex];
            const y = yCoordinates[yIndex];
            const bcr = document.elementFromPoint(x, y)?.getBoundingClientRect() ?? null;
            probe.push(bcr ? fromBcrToRect(bcr) : null);
        }
    }

    return probe;
}

export function computeCaptureSpecs(
    selectors: string[],
    logger?: (...args: unknown[]) => unknown
): ComputeCaptureSpecsResult {
    if (selectors.length === 0) {
        throw new Error("No selectors to compute capture area");
    }
    logger?.("========== <computeCaptureSpecs> ==========");
    logger?.("selectors:", selectors);
    const startTime = performance.now();

    const elements: Array<{ element: Element; pseudoElement: PseudoElementSelector | null }> = [];
    for (let i = 0; i < selectors.length; i++) {
        const parsedSelector = parseCaptureSelector(selectors[i]);
        const element = document.querySelector(parsedSelector.elementSelector);
        if (element) {
            elements.push({ element, pseudoElement: parsedSelector.pseudoElement });
        }
    }

    const captureSpecs = elements
        .map(function ({ element, pseudoElement }) {
            const full = pseudoElement
                ? getPseudoElementCaptureRect(element, pseudoElement)
                : getElementCaptureRect(element, logger);
            if (!full) return null;
            const clip = getClipRect(element, logger);
            const visible = getIntersection(full, clip) ?? {
                top: full.top,
                left: full.left,
                width: 0 as typeof full.width,
                height: 0 as typeof full.height
            };
            return { full, visible };
        })
        .filter(function (r): r is NonNullable<typeof r> {
            return r !== null;
        });

    logger?.("captureSpecs:", captureSpecs);

    logger?.("computeCaptureSpecs time taken:", (performance.now() - startTime).toFixed(1) + "ms");
    logger?.("========== </computeCaptureSpecs> ==========");

    return { captureSpecs };
}

export function computeIgnoreAreas(selectors: string[] = []): ComputeIgnoreAreasResult {
    const ignoreAreas: Rect<"viewport", "css">[] = [];

    for (let s = 0; s < selectors.length; s++) {
        const parsedSelector = parseCaptureSelector(selectors[s]);
        const nodeList = document.querySelectorAll(parsedSelector.elementSelector);
        for (let i = 0; i < nodeList.length; i++) {
            const rect = parsedSelector.pseudoElement
                ? getPseudoElementCaptureRect(nodeList[i], parsedSelector.pseudoElement)
                : getElementCaptureRect(nodeList[i]);
            if (rect !== null) {
                ignoreAreas.push(rect);
            }
        }
    }

    return { ignoreAreas };
}

export function computeSafeArea(
    selectorsToCapture: string[],
    scrollElement?: Element,
    logger?: (...args: unknown[]) => unknown
): ComputeSafeAreaResult {
    logger?.("========== <computeSafeArea> ==========");
    const startTime = performance.now();

    const viewportSize = computeViewportSize().viewportSize;
    const viewportRect: Rect<"viewport", "css"> = {
        left: 0 as Coord<"viewport", "css", "x">,
        top: 0 as Coord<"viewport", "css", "y">,
        width: viewportSize.width as Length<"css", "x">,
        height: viewportSize.height as Length<"css", "y">
    };
    const captureElements = selectorsToCapture
        .map(s => document.querySelector(parseCaptureSelector(s).elementSelector))
        .filter((e): e is NonNullable<typeof e> => e !== null);
    const captureSpecs = computeCaptureSpecs(selectorsToCapture).captureSpecs.map(s => s.full);

    if (captureSpecs.length === 0) {
        return {
            safeArea: { top: viewportRect.top, height: viewportRect.height }
        };
    }

    const captureArea = getCoveringRect(captureSpecs);
    const scrollEl = scrollElement ?? document.documentElement;

    // 1. Base safe area equals the visible rectangle of the scroll container
    let safeArea: Rect<"viewport", "css">;
    if (scrollEl === document.documentElement) {
        logger?.("setting base safe area to viewport rect");
        safeArea = { ...viewportRect };
    } else {
        const contentRect = getBoundingClientContentRect(scrollEl);
        logger?.(
            "setting base safe area to visible part of scroll container:",
            getReadableElementDescriptor(scrollEl),
            "contentRect:",
            contentRect
        );
        safeArea = getIntersection(contentRect, viewportRect) ?? { ...viewportRect };

        const { top: topRadiusInset, bottom: bottomRadiusInset } = getVerticalRadiusInsets(scrollEl);
        if (topRadiusInset > 0 || bottomRadiusInset > 0) {
            const safeAreaHeight = safeArea.height as number;
            const topInset = Math.min(topRadiusInset, safeAreaHeight);
            const bottomInset = Math.min(bottomRadiusInset, safeAreaHeight - topInset);

            logger?.("applying radius insets to safe area:", { topInset, bottomInset });
            safeArea = {
                ...safeArea,
                top: ((safeArea.top as number) + topInset) as Coord<"viewport", "css", "y">,
                height: (safeAreaHeight - topInset - bottomInset) as Length<"css", "y">
            };
        }
    }

    const originalSafeArea = { ...safeArea };

    // 2. Build z-index chains for all capture elements
    //    One z-chain is a list of objects: { stacking context, z-index } -> { stacking context, z-index } -> ...
    //    It is used to determine which element is on top of the other
    const targetChains = captureElements.map(el => buildZChain(el));

    const captureLeft = captureArea.left as number;
    const captureRight = captureLeft + (captureArea.width as number);

    // 3. Detect interfering elements
    const interferences: { element: Element; rect: Rect<"viewport", "css"> }[] = [];
    const allElements = document.documentElement.querySelectorAll("*");

    for (let idx = 0; idx < allElements.length; idx++) {
        const el = allElements[idx];

        // Skip elements that contain capture elements
        if (captureElements.some(capEl => el !== capEl && el.contains(capEl))) continue;

        const computedStyle = getComputedStyle(el);
        const position = computedStyle.position;
        const bcr = el.getBoundingClientRect();

        // Skip invisible elements
        if (
            bcr.width < 1 ||
            bcr.height < 1 ||
            (bcr.width === 1 && bcr.height === 1) ||
            computedStyle.visibility === "hidden" ||
            computedStyle.display === "none" ||
            parseFloat(computedStyle.opacity) < 0.0001
        )
            continue;
        // Skip elements that don't horizontally intersect with capture area
        if (bcr.right <= captureLeft || bcr.left >= captureRight) continue;
        // Skip elements that are outside of viewport
        if (getIntersection(fromBcrToRect(bcr), viewportRect) === null) continue;

        let likelyInterferes = false;
        let adjustedRect: Rect<"viewport", "css"> = domRectToViewportCss(bcr);

        const fixedPositionedParent = findFixedPositionedParent(el);

        if (
            position === "fixed" ||
            (fixedPositionedParent && !captureElements.some(capEl => fixedPositionedParent.contains(capEl)))
        ) {
            likelyInterferes = true;
        } else if (position === "absolute") {
            // Skip absolutely positioned elements that are inside capture elements
            if (captureElements.some(capEl => capEl.contains(el))) continue;

            // Absolute elements interfere only if positioned relative to ancestor outside scroll container
            const containingBlock = findContainingBlock(el);
            // scrollElem may be window, in which case it doesn't have a contains method
            if (scrollEl !== document.documentElement && !scrollEl.contains(containingBlock)) {
                likelyInterferes = true;
            }
        } else if (position === "sticky") {
            // Sticky elements interfere based on their top/bottom values
            let topValue = parseFloat(computedStyle.top);
            const bottomValue = parseFloat(computedStyle.bottom);

            const scrollParent = getScrollParent(el) ?? document.documentElement;
            logger?.("scrollParent:", getReadableElementDescriptor(scrollParent));
            const scrollParentBcr = scrollParent.getBoundingClientRect();
            topValue += isRootLikeElement(scrollParent) ? 0 : scrollParentBcr.top;

            if (!isNaN(topValue)) {
                adjustedRect = {
                    left: bcr.left as Coord<"viewport", "css", "x">,
                    top: topValue as Coord<"viewport", "css", "y">,
                    width: bcr.width as Length<"css", "x">,
                    height: bcr.height as Length<"css", "y">
                };
                likelyInterferes = true;
            } else if (!isNaN(bottomValue)) {
                const isRoot = scrollEl === document.documentElement;
                const viewportBottom = isRoot
                    ? (viewportRect.height as number)
                    : (safeArea.top as number) + (safeArea.height as number);
                adjustedRect = {
                    left: bcr.left as Coord<"viewport", "css", "x">,
                    top: (viewportBottom - bottomValue - bcr.height) as Coord<"viewport", "css", "y">,
                    width: bcr.width as Length<"css", "x">,
                    height: bcr.height as Length<"css", "y">
                };
                likelyInterferes = true;
            }
        }

        if (!likelyInterferes) continue;

        const candChain = buildZChain(el);
        const behindAll = targetChains.every(tChain => isChainBehind(candChain, tChain));

        if (!behindAll) {
            const extRect = getExtRect(computedStyle, adjustedRect);
            const extLeft = extRect.left as number;
            const extRight = extLeft + (extRect.width as number);

            if (extRight <= captureLeft || extLeft >= captureRight) continue;

            interferences.push({ element: el, rect: extRect });
        }
    }

    let safeTop = safeArea.top as Coord<"viewport", "css", "y">;
    let safeHeight = safeArea.height as Length<"css", "y">;
    const origHeight = originalSafeArea.height as number;

    // 4. Shrink safe area according to interfering elements
    for (const interference of interferences) {
        logger?.("processing interference:", {
            element: getReadableElementDescriptor(interference.element),
            rect: interference.rect
        });

        const br = interference.rect;
        const safeBottom = getBottom({ top: safeTop, height: safeHeight });
        const brBottom = getBottom(br);
        const shrinkTop = brBottom > safeTop ? brBottom - safeTop : null;
        const shrinkBottom = safeBottom > br.top ? safeBottom - br.top : null;

        let resultingTop = safeTop;
        let resultingHeight = safeHeight;

        if (shrinkTop && shrinkBottom && shrinkTop < shrinkBottom) {
            resultingTop = brBottom;
            resultingHeight = getHeight(safeBottom, resultingTop);
            logger?.("decided to shrink top");
        } else if (shrinkBottom) {
            resultingHeight = getHeight(safeTop, br.top);
            logger?.("decided to shrink bottom");
        }

        if (resultingHeight < origHeight / 2) {
            logger?.("decided to skip, because shrinking is too large");
            continue;
        }

        logger?.("resulting safe area top:", resultingTop, "resulting safe area height:", resultingHeight);

        safeTop = resultingTop;
        safeHeight = resultingHeight;
    }

    // 5. Ensure we didn't shrink more than 50% of original height
    if (safeHeight < origHeight / 2) {
        safeTop = originalSafeArea.top;
        safeHeight = originalSafeArea.height;
    }

    // Safari on iOS 26 has a large blur at the bottom that interferes with scrolling, so
    // if safe area ends too low, we shrink it by 40px which is enough to avoid the blur.
    if (isSafariMobile() && viewportSize.height - (safeTop + safeHeight) < 40) {
        safeHeight = (safeHeight - 40) as Length<"css", "y">;
    }

    const finalSafeArea = {
        top: safeTop,
        height: safeHeight
    };

    logger?.("final safe area:", finalSafeArea);
    logger?.("computeSafeArea time taken:", (performance.now() - startTime).toFixed(1) + "ms");
    logger?.("========== </computeSafeArea> ==========");

    return {
        safeArea: finalSafeArea
    };
}

export function computeDocumentSize(): ComputeDocumentSizeResult {
    const mainDocumentElem = getMainDocumentElem();
    return {
        documentSize: {
            width: mainDocumentElem.scrollWidth as Length<"css", "x">,
            height: mainDocumentElem.scrollHeight as Length<"css", "y">
        }
    };
}

export function computeCanHaveCaret(): ComputeCanHaveCaretResult {
    const el = document.activeElement;
    const canHaveCaret = el instanceof HTMLElement && (/^(input|textarea)$/i.test(el.tagName) || el.isContentEditable);

    return { canHaveCaret };
}

export function computePixelRatio(usePixelRatio: boolean = true): ComputePixelRatioResult {
    if (usePixelRatio === false) {
        return { pixelRatio: 1 };
    }

    if (window.devicePixelRatio) {
        return { pixelRatio: window.devicePixelRatio };
    }

    // for ie6-ie10 (https://developer.mozilla.org/ru/docs/Web/API/Window/devicePixelRatio)
    // @ts-expect-error - IE hack
    return { pixelRatio: window.screen.deviceXDPI / window.screen.logicalXDPI || 1 };
}

export function scrollToCaptureAreaIfNeeded(
    selectorsToCapture: string[],
    captureElementFromTop?: boolean,
    allowViewportOverflow?: boolean,
    selectorToScroll?: string,
    logger?: (...args: unknown[]) => unknown
): ScrollToCaptureSpecResult {
    const viewportSize = computeViewportSize().viewportSize;
    const viewport = {
        top: 0 as Coord<"viewport", "css", "y">,
        left: 0 as Coord<"viewport", "css", "x">,
        ...viewportSize
    };

    const captureSpecsResult = computeCaptureSpecs(selectorsToCapture);
    if (!captureSpecsResult) return {};

    const captureArea = getCoveringRect(captureSpecsResult.captureSpecs.map(s => s.full));
    // const captureElements = selectorsToCapture.flatMap(s => Array.from(document.querySelectorAll(s)));
    const safeArea = computeSafeArea(selectorsToCapture).safeArea;

    const captureAndSafeAreasIntersection = getIntersection(captureArea, safeArea);
    const captureAndViewportIntersection = getIntersection(captureArea, viewport);
    const isIntersectionWithSafeAreaTooSmall =
        !captureAndSafeAreasIntersection || captureAndSafeAreasIntersection.height < captureArea.height / 2;
    const isCaptureAreaStartVisible = captureArea.top >= safeArea.top;
    logger?.("scrollToCaptureAreaIfNeeded: intersection check", {
        captureArea,
        safeArea,
        viewport,
        hasViewportIntersection: Boolean(captureAndViewportIntersection),
        hasSafeAreaIntersection: Boolean(captureAndSafeAreasIntersection),
        isIntersectionWithSafeAreaTooSmall,
        captureElementFromTop: Boolean(captureElementFromTop)
    });

    if (!captureElementFromTop && !captureAndViewportIntersection) {
        logger?.(
            "scrollToCaptureAreaIfNeeded: throwing OutsideOfViewportError because captureElementFromTop is disabled and target is outside viewport"
        );
        throw new OutsideOfViewportError();
    }

    if ((!captureElementFromTop || !isIntersectionWithSafeAreaTooSmall) && isCaptureAreaStartVisible) {
        logger?.("scrollToCaptureAreaIfNeeded: skipping scroll", {
            reason: !captureElementFromTop
                ? "captureElementFromTop is disabled"
                : "target already has enough safe area visibility"
        });
        return {};
    }

    if (!captureElementFromTop && allowViewportOverflow) {
        logger?.(
            "scrollToCaptureAreaIfNeeded: skipping scroll because allowViewportOverflow is true and captureElementFromTop is false"
        );
        return {};
    }

    const scrollTarget = selectorToScroll ? document.querySelector(selectorToScroll) : null;
    const selectorsForScrollParentSearch = selectorsToCapture.map(
        selector => parseCaptureSelector(selector).elementSelector
    );
    const initialScrollElem = scrollTarget ?? getCommonScrollParent(selectorsForScrollParentSearch);
    const readableSelectorToScrollDescr = selectorToScroll ?? getReadableElementDescriptor(initialScrollElem);
    logger?.("scrollToCaptureAreaIfNeeded: scrolling is required", {
        scrollElement: readableSelectorToScrollDescr,
        requestedSelectorToScroll: selectorToScroll ?? null,
        selectorMatched: Boolean(scrollTarget)
    });

    const scrollChain = [...getScrollParentsChain(initialScrollElem)];
    if (scrollChain[scrollChain.length - 1] !== initialScrollElem) {
        scrollChain.push(initialScrollElem);
    }

    for (let i = 1; i < scrollChain.length; i++) {
        const currentSafeArea = computeSafeArea(selectorsToCapture, scrollChain[i - 1]).safeArea;
        const childTop = scrollChain[i].getBoundingClientRect().top;
        const scrollDelta = childTop - currentSafeArea.top;
        logger?.("scrollToCaptureAreaIfNeeded: scrolling chain element", {
            scrollElement: getReadableElementDescriptor(scrollChain[i - 1]),
            childElement: getReadableElementDescriptor(scrollChain[i]),
            scrollDelta
        });
        scrollElementBy(scrollChain[i - 1], scrollDelta as Coord<"page", "css", "y">, logger);
    }

    const finalCaptureArea = getCoveringRect(computeCaptureSpecs(selectorsToCapture).captureSpecs.map(s => s.full));
    if (!finalCaptureArea) return {};

    const finalSafeArea = computeSafeArea(selectorsToCapture, initialScrollElem).safeArea;
    const finalScrollDelta = finalCaptureArea.top - finalSafeArea.top;
    logger?.("scrollToCaptureAreaIfNeeded: final alignment scroll", {
        scrollElement: readableSelectorToScrollDescr,
        finalScrollDelta
    });
    scrollElementBy(initialScrollElem, finalScrollDelta as Coord<"page", "css", "y">, logger);

    return {
        readableSelectorToScrollDescr
    };
}

function saveElementScrollPosition(element: Element): void {
    const namespaceData = getScreenshooterNamespaceData();
    if (!namespaceData.savedScrollPositions) {
        namespaceData.savedScrollPositions = [];
    }

    if (namespaceData.savedScrollPositions.some(saved => saved.element === element)) {
        return;
    }

    const savedPosition: ElementScrollPosition = isRootLikeElement(element)
        ? {
              element,
              left: window.scrollX,
              top: window.scrollY
          }
        : {
              element,
              left: (element as HTMLElement).scrollLeft,
              top: (element as HTMLElement).scrollTop
          };

    namespaceData.savedScrollPositions.push(savedPosition);
}

export function saveScrollPositions(selectorsToCapture: string[], selectorToScroll?: string): void {
    getScreenshooterNamespaceData().savedScrollPositions = [];

    const scrollTarget = selectorToScroll ? document.querySelector(selectorToScroll) : null;
    const selectorsForScrollParentSearch = selectorsToCapture.map(
        selector => parseCaptureSelector(selector).elementSelector
    );
    const initialScrollElement = scrollTarget ?? getCommonScrollParent(selectorsForScrollParentSearch);
    const scrollChain = [...getScrollParentsChain(initialScrollElement)];

    if (scrollChain[scrollChain.length - 1] !== initialScrollElement) {
        scrollChain.push(initialScrollElement);
    }

    for (const scrollElement of scrollChain) {
        saveElementScrollPosition(scrollElement);
    }
}

export function prepareFullPageScrollCleanup(): void {
    getScreenshooterNamespaceData().savedScrollPositions = [];
    saveElementScrollPosition(document.documentElement);
}

function restoreScrollPosition(savedPosition: ElementScrollPosition): void {
    if (isRootLikeElement(savedPosition.element)) {
        performScrollFixForSafariIfNeeded(savedPosition.top);
        window.scrollTo(savedPosition.left, savedPosition.top);
        return;
    }

    const scrollElement = savedPosition.element as Element & {
        scrollTo?: (left: number, top: number) => void;
        scrollLeft?: number;
        scrollTop?: number;
    };

    if (typeof scrollElement.scrollTo === "function") {
        scrollElement.scrollTo(savedPosition.left, savedPosition.top);
        return;
    }

    if (typeof scrollElement.scrollLeft === "number") {
        scrollElement.scrollLeft = savedPosition.left;
    }
    if (typeof scrollElement.scrollTop === "number") {
        scrollElement.scrollTop = savedPosition.top;
    }
}

export function cleanupSavedScrolls(): void {
    try {
        const namespaceData = getScreenshooterNamespaceData();
        const savedScrollPositions = namespaceData.savedScrollPositions ?? [];
        namespaceData.savedScrollPositions = [];

        for (const savedScrollPosition of savedScrollPositions) {
            try {
                restoreScrollPosition(savedScrollPosition);
            } catch (error) {
                void error;
            }
        }
    } catch (error) {
        void error;
    }
}

export function disableAnimations(): void {
    const everyElementSelector = "*:not(#testplane-q.testplane-w.testplane-e.testplane-r.testplane-t.testplane-y)";
    const everythingSelector = ["", "::before", "::after"]
        .map(function (pseudo) {
            return everyElementSelector + pseudo;
        })
        .join(", ");

    const styleElements: HTMLStyleElement[] = [];

    function appendDisableAnimationStyleElement(root: Element | ShadowRoot): void {
        const styleElement = document.createElement("style");
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

    forEachRoot(function (root) {
        try {
            appendDisableAnimationStyleElement(root);
        } catch (err: unknown) {
            if (
                err &&
                (err as Error).message &&
                (err as Error).message.indexOf("This document requires 'TrustedHTML' assignment") !== -1
            ) {
                createDefaultTrustedTypesPolicy();

                appendDisableAnimationStyleElement(root);
            } else {
                throw err;
            }
        }
    });

    window.__cleanupAnimation = function (): void {
        for (let i = 0; i < styleElements.length; i++) {
            // IE11 doesn't have remove() on node
            styleElements[i].parentNode!.removeChild(styleElements[i]);
        }

        delete window.__cleanupAnimation;
    };
}

export function disablePointerEvents(): void {
    const everyElementSelector = "*:not(#testplane-q.testplane-w.testplane-e.testplane-r.testplane-t.testplane-y)";
    const everythingSelector = ["", "::before", "::after"]
        .map(function (pseudo) {
            return everyElementSelector + pseudo;
        })
        .join(", ");

    const styleElements: HTMLStyleElement[] = [];

    function appendDisablePointerEventsStyleElement(root: Element | ShadowRoot): void {
        const styleElement = document.createElement("style");
        styleElement.innerHTML = everythingSelector + ["{", "    pointer-events: none !important;", "}"].join("\n");

        root.appendChild(styleElement);
        styleElements.push(styleElement);
    }

    forEachRoot(function (root) {
        try {
            appendDisablePointerEventsStyleElement(root);
        } catch (err) {
            if (
                err &&
                (err as Error).message &&
                (err as Error).message.indexOf("This document requires 'TrustedHTML' assignment") !== -1
            ) {
                createDefaultTrustedTypesPolicy();

                appendDisablePointerEventsStyleElement(root);
            } else {
                throw err;
            }
        }
    });

    const namespaceData = getScreenshooterNamespaceData();
    namespaceData.cleanupPointerEventsCb = function (): void {
        for (let i = 0; i < styleElements.length; i++) {
            styleElements[i].parentNode!.removeChild(styleElements[i]);
        }
    };
}
