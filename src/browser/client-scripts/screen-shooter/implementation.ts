import {
    BrowserSideError,
    BrowserSideErrorCode,
    Coord,
    DisableHoverMode,
    Length,
    ceilCoords,
    floorCoords,
    fromBcrToRect,
    fromCssToDevice,
    fromCssToDeviceNumber,
    fromDeviceToCssNumber,
    getBottom,
    getCoveringRect,
    getIntersection,
    roundCoords
} from "@isomorphic";
import {
    PrepareScreenshotOptions,
    PrepareScreenshotResult,
    PrepareScreenshotSuccess,
    PrepareFullPageScreenshotResult,
    PrepareViewportScreenshotResult,
    ScrollFullPageResult,
    ScrollResult,
    GetCaptureStateResult,
    TrackedElementData
} from "./types";
import { createDebugLogger } from "../shared/logger";
import {
    scrollToCaptureAreaIfNeeded,
    disableAnimations,
    computeCaptureSpecs,
    computeIgnoreAreas,
    computeViewportSize,
    computeViewportOffset,
    computeSafeArea,
    computeDocumentSize,
    computeCanHaveCaret,
    computePixelRatio,
    disablePointerEvents as disablePointerEventsUnsafe,
    computeElementPositionsProbe,
    saveScrollPositions,
    prepareFullPageScrollCleanup,
    cleanupSavedScrolls,
    computeScrollOffset
} from "./operations";
import { getReadableElementDescriptor } from "./utils/descriptions";
import { getScreenshooterNamespaceData } from "./utils/dom";
import { getCommonScrollParent, scrollElementBy, scrollElementToOffset } from "./utils/scroll";

declare global {
    // eslint-disable-next-line no-var
    var __cleanupAnimation: undefined | (() => void);
}

const MIN_ANCHOR_SAMPLE_SIZE = 3;
const MAX_ANCHOR_TRACKED_ELEMENTS = 500;
/** Tolerance in CSS pixels for binning observed viewport shift deltas */
const ANCHOR_SHIFT_TOLERANCE_CSS = 1.5;

function sampleRandom<T>(items: T[], maxCount: number): T[] {
    if (items.length <= maxCount) return items.slice();
    const arr = items.slice();
    for (let i = 0; i < maxCount; i++) {
        const j = i + Math.floor(Math.random() * (arr.length - i));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
    return arr.slice(0, maxCount);
}

/** Finds the densest tolerance-wide window and returns its median value. */
function computeShiftMode(deltas: number[], tolerance: number): number | null {
    if (deltas.length === 0) {
        return null;
    }

    const sortedDeltas = deltas.slice().sort((a, b) => a - b);
    let bestWindowStartIndex = 0;
    let bestWindowEndIndex = 0;

    for (let startIndex = 0, endIndex = 0; startIndex < sortedDeltas.length; startIndex++) {
        while (
            endIndex + 1 < sortedDeltas.length &&
            sortedDeltas[endIndex + 1] - sortedDeltas[startIndex] <= tolerance
        ) {
            endIndex++;
        }

        const currentWindowSize = endIndex - startIndex + 1;
        const bestWindowSize = bestWindowEndIndex - bestWindowStartIndex + 1;
        const shouldPreferCurrentWindow = currentWindowSize > bestWindowSize;

        if (shouldPreferCurrentWindow) {
            bestWindowStartIndex = startIndex;
            bestWindowEndIndex = endIndex;
        }
    }

    const dominantValues = sortedDeltas.slice(bestWindowStartIndex, bestWindowEndIndex + 1);
    const middleIndex = Math.floor(dominantValues.length / 2);

    if (dominantValues.length % 2 === 1) {
        return dominantValues[middleIndex];
    }

    return (dominantValues[middleIndex - 1] + dominantValues[middleIndex]) / 2;
}

/** This function is useful to understand what actually is going on when capture area unexpectedly changes size/top position.
 * It returns the actual shift of the capture area compared to the baseline.
 * This shift can then be compared to the shift of the whole capture area to compute correction delta. */
function computeActualShift(): Length<"css", "y"> | null {
    const { trackedElementsData } = getScreenshooterNamespaceData();
    if (!trackedElementsData || trackedElementsData.length === 0) {
        return null;
    }

    const verticalDeltas: number[] = [];
    for (const trackedElementData of trackedElementsData) {
        if (!trackedElementData.element.isConnected) {
            continue;
        }

        const currentRect = trackedElementData.element.getBoundingClientRect();
        const baselineRect = trackedElementData.rect;

        if (currentRect.width <= 0 || currentRect.height <= 0) {
            continue;
        }

        if (
            Math.abs(currentRect.width - baselineRect.width) > 1 ||
            Math.abs(currentRect.height - baselineRect.height) > 1
        ) {
            continue;
        }

        verticalDeltas.push(currentRect.top - baselineRect.top);
    }
    if (verticalDeltas.length < MIN_ANCHOR_SAMPLE_SIZE) {
        return null;
    }

    const shiftCss = computeShiftMode(verticalDeltas, ANCHOR_SHIFT_TOLERANCE_CSS);

    return shiftCss === null ? null : (shiftCss as Length<"css", "y">);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeCall<T extends (...args: any[]) => any>(
    callback: T,
    ...args: Parameters<T>
): ReturnType<T> | BrowserSideError {
    try {
        return callback(...args) as ReturnType<T>;
    } catch (e: unknown) {
        if (e instanceof Error) {
            return {
                errorCode: BrowserSideErrorCode.JS,
                message: e.stack || e.message
            };
        }
        return {
            errorCode: BrowserSideErrorCode.JS,
            message: "Unknown error: " + String(e)
        };
    }
}

export function prepareElementsScreenshot(
    selectorsToCapture: string[],
    opts: PrepareScreenshotOptions
): PrepareScreenshotResult {
    return safeCall(prepareElementsScreenshotUnsafe, selectorsToCapture, opts);
}

export function scrollBy(
    selectorsToCapture: string[],
    scrollDelta: Length<"device", "y"> | Coord<"page", "device", "y">,
    selectorToScroll?: string | null,
    debug?: string[]
): ScrollResult {
    return safeCall((): ScrollResult => {
        const logger = createDebugLogger({ debug }, "scrollBy");
        const pixelRatio = computePixelRatio();
        const scrollTarget = selectorToScroll ? document.querySelector(selectorToScroll) : null;
        const scrollElement = scrollTarget ?? getCommonScrollParent(selectorsToCapture);

        const readableAutoScrollElementDescr = getReadableElementDescriptor(scrollElement);
        const readableSelectorToScrollDescr = selectorToScroll
            ? scrollTarget
                ? `${selectorToScroll} (${readableAutoScrollElementDescr})`
                : `${selectorToScroll} (not found, auto-detected ${readableAutoScrollElementDescr})`
            : `auto-detected ${readableAutoScrollElementDescr}`;

        // Subtracting 1px to avoid a case when element boundary gets rounded up and it appears during screenshots stitching
        const scrollHeightCss = (fromDeviceToCssNumber(scrollDelta as Coord<"page", "device", "y">, pixelRatio) -
            1) as Coord<"page", "css", "y">;
        scrollElementBy(scrollElement, scrollHeightCss);

        return {
            readableSelectorToScrollDescr,
            debugLog: logger()
        };
    });
}

export function scrollTo(
    selectorsToCapture: string[],
    scrollOffset: Length<"device", "y"> | Coord<"page", "device", "y">,
    selectorToScroll?: string | null,
    debug?: string[]
): ScrollResult {
    return safeCall((): ScrollResult => {
        const logger = createDebugLogger({ debug }, "scrollTo");
        logger(
            "Asked to scroll to with params: selectorsToCapture:",
            selectorsToCapture,
            "scrollOffset:",
            scrollOffset,
            "selectorToScroll:",
            selectorToScroll
        );
        const pixelRatio = computePixelRatio();
        const scrollTarget = selectorToScroll ? document.querySelector(selectorToScroll) : null;
        const scrollElement = scrollTarget ?? getCommonScrollParent(selectorsToCapture);

        const readableAutoScrollElementDescr = getReadableElementDescriptor(scrollElement);
        const readableSelectorToScrollDescr = selectorToScroll
            ? scrollTarget
                ? `${selectorToScroll} (${readableAutoScrollElementDescr})`
                : `${selectorToScroll} (not found, auto-detected ${readableAutoScrollElementDescr})`
            : `auto-detected ${readableAutoScrollElementDescr}`;

        const scrollOffsetCss = fromDeviceToCssNumber(
            scrollOffset as Coord<"page", "device", "y">,
            pixelRatio
        ) as Coord<"page", "css", "y">;
        scrollElementToOffset(scrollElement, scrollOffsetCss);

        return {
            readableSelectorToScrollDescr,
            debugLog: logger()
        };
    });
}

/** Returns current state: positions of elements to capture, ignore areas, safe area, scroll offset */
export function getCaptureState(
    selectorsToCapture: string[],
    selectorsToIgnore: string[],
    selectorToScroll?: string | null,
    debug?: string[]
): GetCaptureStateResult {
    return safeCall((): GetCaptureStateResult => {
        const logger = createDebugLogger({ debug }, "getCaptureState");
        const pixelRatio = computePixelRatio();
        const scrollTarget = selectorToScroll ? document.querySelector(selectorToScroll) : null;
        const scrollElement = scrollTarget ?? getCommonScrollParent(selectorsToCapture);
        const readableAutoScrollElementDescr = getReadableElementDescriptor(scrollElement);
        const readableSelectorToScrollDescr = selectorToScroll
            ? scrollTarget
                ? `${selectorToScroll} (${readableAutoScrollElementDescr})`
                : `${selectorToScroll} (not found, auto-detected ${readableAutoScrollElementDescr})`
            : `auto-detected ${readableAutoScrollElementDescr}`;
        const ignoreAreas = computeIgnoreAreas(selectorsToIgnore);
        const safeArea = computeSafeArea(selectorsToCapture, scrollElement, logger);
        const captureSpecsAfterCss = computeCaptureSpecs(selectorsToCapture, logger);
        const captureSpecs = captureSpecsAfterCss.map(spec => ({
            full: fromCssToDevice(roundCoords(spec.full), pixelRatio),
            visible: fromCssToDevice(roundCoords(spec.visible), pixelRatio)
        }));
        const scrollOffset = computeScrollOffset(scrollElement);
        const viewportOffset = computeViewportOffset();

        const anchorShift = computeActualShift();
        const anchorShiftDevice = anchorShift === null ? null : fromCssToDeviceNumber(anchorShift, pixelRatio);

        logger("scrollOffset:", scrollOffset);

        return {
            captureSpecs,
            ignoreAreas: ignoreAreas.map(area => fromCssToDevice(roundCoords(area), pixelRatio)),
            safeArea: fromCssToDevice(roundCoords(safeArea), pixelRatio),
            scrollOffset: fromCssToDeviceNumber(scrollOffset, pixelRatio),
            viewportOffset: fromCssToDevice(floorCoords(viewportOffset), pixelRatio),
            anchorShift: anchorShiftDevice,
            readableSelectorToScrollDescr,
            debugLog: logger()
        };
    });
}

export function prepareFullPageScreenshot(
    opts: { usePixelRatio?: boolean; disableAnimation?: boolean; disableHover?: DisableHoverMode } = {}
): PrepareFullPageScreenshotResult {
    return safeCall((): PrepareFullPageScreenshotResult => {
        prepareFullPageScrollCleanup();

        const pixelRatio = computePixelRatio(opts.usePixelRatio);

        window.scrollTo(0, 0);

        const documentSize = computeDocumentSize();
        const viewportSize = computeViewportSize();
        const viewportOffset = computeViewportOffset();
        const safeArea = computeSafeArea(["body"], document.documentElement);

        if (opts.disableAnimation) {
            disableAnimations();
        }

        let pointerEventsDisabled = false;
        if (opts.disableHover === DisableHoverMode.Always) {
            disablePointerEventsUnsafe();
            pointerEventsDisabled = true;
        } else if (opts.disableHover === DisableHoverMode.WhenScrollingNeeded) {
            const needsScrolling = documentSize.height > viewportSize.height;

            if (needsScrolling) {
                disablePointerEventsUnsafe();
                pointerEventsDisabled = true;
            }
        }

        const elementPositionsProbe = computeElementPositionsProbe().map(rect =>
            rect ? fromCssToDevice(roundCoords(rect), pixelRatio) : null
        );

        return {
            documentSize: ceilCoords(fromCssToDevice(documentSize, pixelRatio)),
            viewportSize: fromCssToDevice(viewportSize, pixelRatio),
            viewportOffset: fromCssToDevice(floorCoords(viewportOffset), pixelRatio),
            safeArea: fromCssToDevice(roundCoords(safeArea), pixelRatio),
            elementPositionsProbe,
            pixelRatio,
            pointerEventsDisabled
        };
    });
}

export function scrollFullPage(
    scrollHeight: Length<"device", "y"> | Coord<"page", "device", "y">,
    opts: { usePixelRatio?: boolean } = {}
): ScrollFullPageResult {
    return safeCall((): ScrollFullPageResult => {
        const pixelRatio = computePixelRatio(opts.usePixelRatio);
        const scrollHeightCss = (fromDeviceToCssNumber(scrollHeight as Coord<"page", "device", "y">, pixelRatio) -
            1) as Coord<"page", "css", "y">;

        scrollElementBy(document.documentElement, scrollHeightCss);

        const viewportOffset = computeViewportOffset();
        const elementPositionsProbe = computeElementPositionsProbe().map(rect =>
            rect ? fromCssToDevice(roundCoords(rect), pixelRatio) : null
        );

        return {
            viewportOffset: fromCssToDevice(floorCoords(viewportOffset), pixelRatio),
            elementPositionsProbe
        };
    });
}

export function prepareViewportScreenshot(
    opts: { usePixelRatio?: boolean; disableAnimation?: boolean; disableHover?: DisableHoverMode } = {}
): PrepareViewportScreenshotResult {
    return safeCall((): PrepareViewportScreenshotResult => {
        const pixelRatio = computePixelRatio(opts.usePixelRatio);
        const viewportSize = computeViewportSize();
        const viewportOffset = computeViewportOffset();
        const documentSize = computeDocumentSize();
        const canHaveCaret = computeCanHaveCaret();

        if (opts.disableAnimation) {
            disableAnimations();
        }

        let pointerEventsDisabled = false;
        if (opts.disableHover === DisableHoverMode.Always) {
            disablePointerEventsUnsafe();
            pointerEventsDisabled = true;
        }

        return {
            viewportSize: fromCssToDevice(viewportSize, pixelRatio),
            viewportOffset: fromCssToDevice(floorCoords(viewportOffset), pixelRatio),
            documentSize: ceilCoords(fromCssToDevice(documentSize, pixelRatio)),
            canHaveCaret,
            pixelRatio,
            pointerEventsDisabled
        };
    });
}

export function disableFrameAnimations(): void | BrowserSideError {
    return safeCall(disableAnimations);
}

export function cleanupFrameAnimations(): void {
    if (window.__cleanupAnimation) {
        window.__cleanupAnimation();
    }
}

export function disablePointerEvents(): void | BrowserSideError {
    return safeCall(disablePointerEventsUnsafe);
}

export function cleanupPointerEvents(): void {
    const screenshooterNamespaceData = getScreenshooterNamespaceData();
    if (screenshooterNamespaceData.cleanupPointerEventsCb) {
        screenshooterNamespaceData.cleanupPointerEventsCb();
    }
}

export function cleanupScrolls(): void {
    getScreenshooterNamespaceData().trackedElementsData = [];
    cleanupSavedScrolls();
}

/**
 * Records up to 500 random non-degenerate descendants of the capture elements as anchor baselines.
 * Must be called once before the best-effort capture pass; getCaptureState will then return anchorShift.
 */
export function captureAnchorBaseline(selectorsToCapture: string[]): void | BrowserSideError {
    return safeCall((): void => {
        const captureSpecs = computeCaptureSpecs(selectorsToCapture);
        const captureArea = captureSpecs.length > 0 ? getCoveringRect(captureSpecs.map(spec => spec.full)) : null;

        const allDescendants: Element[] = [];
        for (let si = 0; si < selectorsToCapture.length; si++) {
            const el = document.querySelector(selectorsToCapture[si]);
            if (!el) continue;
            allDescendants.push(el);
            const nodes = el.querySelectorAll("*");
            for (let ni = 0; ni < nodes.length; ni++) allDescendants.push(nodes[ni]);
        }

        const nonDegenerate = allDescendants.filter(el => {
            const r = el.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) {
                return false;
            }

            if (!captureArea) {
                return true;
            }

            const rect = fromBcrToRect(r);

            return Boolean(getIntersection(captureArea, rect));
        });

        const sampled = sampleRandom(nonDegenerate, MAX_ANCHOR_TRACKED_ELEMENTS);
        getScreenshooterNamespaceData().trackedElementsData = sampled.map((el): TrackedElementData => {
            const r = el.getBoundingClientRect();
            return {
                element: el,
                rect: fromBcrToRect(r)
            };
        });
    });
}

function prepareElementsScreenshotUnsafe(
    selectorsToCapture: string[],
    opts: PrepareScreenshotOptions
): PrepareScreenshotResult {
    const logger = createDebugLogger(opts, "prepareElementsScreenshot");

    saveScrollPositions(selectorsToCapture, opts.selectorToScroll);

    const { readableSelectorToScrollDescr } = scrollToCaptureAreaIfNeeded(
        selectorsToCapture,
        opts.captureElementFromTop,
        opts.allowViewportOverflow,
        opts.selectorToScroll,
        logger
    );

    if (opts.disableAnimation) {
        disableAnimations();
    }

    const pixelRatio = computePixelRatio(opts.usePixelRatio);
    const scrollTarget = opts.selectorToScroll ? document.querySelector(opts.selectorToScroll) : null;
    const scrollElement = scrollTarget ?? getCommonScrollParent(selectorsToCapture);

    const ignoreAreas = computeIgnoreAreas(opts.ignoreSelectors);
    const captureSpecs = computeCaptureSpecs(selectorsToCapture, logger);
    const viewportSize = computeViewportSize();
    const viewportOffset = computeViewportOffset();
    const safeArea = computeSafeArea(selectorsToCapture, scrollElement, logger);
    const scrollOffset = computeScrollOffset(scrollElement);

    const documentSize = computeDocumentSize();
    const canHaveCaret = computeCanHaveCaret();

    let pointerEventsDisabled = false;
    if (opts.disableHover === DisableHoverMode.Always) {
        disablePointerEventsUnsafe();
        pointerEventsDisabled = true;
    } else if (opts.disableHover === DisableHoverMode.WhenScrollingNeeded && opts.compositeImage) {
        const captureArea = getCoveringRect(captureSpecs.map(s => s.full));
        const needsScrolling = getBottom(captureArea) > getBottom(safeArea);

        if (needsScrolling) {
            logger(
                "adding stylesheet with pointer-events: none on all elements (composite capture needs scrolling). captureArea:",
                captureArea,
                "safeArea:",
                safeArea
            );
            disablePointerEventsUnsafe();
            pointerEventsDisabled = true;
        }
    }

    logger("scrollOffset:", scrollOffset);

    return {
        ignoreAreas: ignoreAreas.map(area => fromCssToDevice(roundCoords(area), pixelRatio)),
        captureSpecs: captureSpecs.map(s => ({
            full: fromCssToDevice(roundCoords(s.full), pixelRatio),
            visible: fromCssToDevice(roundCoords(s.visible), pixelRatio)
        })),
        viewportSize: fromCssToDevice(viewportSize, pixelRatio),
        viewportOffset: fromCssToDevice(floorCoords(viewportOffset), pixelRatio),
        safeArea: fromCssToDevice(roundCoords(safeArea), pixelRatio),
        documentSize: ceilCoords(fromCssToDevice(documentSize, pixelRatio)),
        canHaveCaret,
        pixelRatio: pixelRatio,
        pointerEventsDisabled: pointerEventsDisabled,
        debugLog: logger(),
        readableSelectorToScrollDescr,
        scrollOffset: fromCssToDeviceNumber(scrollOffset, pixelRatio)
    } satisfies PrepareScreenshotSuccess;
}
