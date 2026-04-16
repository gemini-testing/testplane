import {
    BrowserSideError,
    BrowserSideErrorCode,
    Coord,
    DisableHoverMode,
    Length,
    ceilCoords,
    floorCoords,
    fromCssToDevice,
    fromCssToDeviceNumber,
    fromDeviceToCssNumber,
    getBottom,
    getCoveringRect,
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
    GetCaptureStateResult
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
        const logger = createDebugLogger({ debug }, "scrollAndRecomputeAreas:scroll");
        const pixelRatio = computePixelRatio().pixelRatio;
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
        const logger = createDebugLogger({ debug }, "scrollAndRecomputeAreas:scroll");
        const pixelRatio = computePixelRatio().pixelRatio;
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
        const logger = createDebugLogger({ debug }, "scrollAndRecomputeAreas:scroll");
        const pixelRatio = computePixelRatio().pixelRatio;
        const scrollTarget = selectorToScroll ? document.querySelector(selectorToScroll) : null;
        const scrollElement = scrollTarget ?? getCommonScrollParent(selectorsToCapture);
        const readableAutoScrollElementDescr = getReadableElementDescriptor(scrollElement);
        const readableSelectorToScrollDescr = selectorToScroll
            ? scrollTarget
                ? `${selectorToScroll} (${readableAutoScrollElementDescr})`
                : `${selectorToScroll} (not found, auto-detected ${readableAutoScrollElementDescr})`
            : `auto-detected ${readableAutoScrollElementDescr}`;
        const ignoreAreas = computeIgnoreAreas(selectorsToIgnore).ignoreAreas;
        const safeArea = computeSafeArea(selectorsToCapture, scrollElement, logger).safeArea;
        const captureSpecsAfterCss = computeCaptureSpecs(selectorsToCapture, logger).captureSpecs;
        const captureSpecs = captureSpecsAfterCss.map(spec => ({
            full: fromCssToDevice(roundCoords(spec.full), pixelRatio),
            visible: fromCssToDevice(roundCoords(spec.visible), pixelRatio)
        }));
        const scrollOffset = computeScrollOffset(scrollElement);

        logger("scrollOffset:", scrollOffset);

        return {
            captureSpecs,
            ignoreAreas: ignoreAreas.map(area => fromCssToDevice(roundCoords(area), pixelRatio)),
            safeArea: fromCssToDevice(roundCoords(safeArea), pixelRatio),
            scrollOffset: fromCssToDeviceNumber(scrollOffset, pixelRatio),
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

        const pixelRatio = computePixelRatio(opts.usePixelRatio).pixelRatio;

        window.scrollTo(0, 0);

        const documentSize = computeDocumentSize().documentSize;
        const viewportSize = computeViewportSize().viewportSize;
        const viewportOffset = computeViewportOffset().viewportOffset;
        const safeArea = computeSafeArea(["body"], document.documentElement).safeArea;

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
        const pixelRatio = computePixelRatio(opts.usePixelRatio).pixelRatio;
        const scrollHeightCss = (fromDeviceToCssNumber(scrollHeight as Coord<"page", "device", "y">, pixelRatio) -
            1) as Coord<"page", "css", "y">;

        scrollElementBy(document.documentElement, scrollHeightCss);

        const viewportOffset = computeViewportOffset().viewportOffset;
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
        const pixelRatio = computePixelRatio(opts.usePixelRatio).pixelRatio;
        const viewportSize = computeViewportSize().viewportSize;
        const viewportOffset = computeViewportOffset().viewportOffset;
        const documentSize = computeDocumentSize().documentSize;
        const canHaveCaret = computeCanHaveCaret().canHaveCaret;

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
    cleanupSavedScrolls();
}

function prepareElementsScreenshotUnsafe(
    selectorsToCapture: string[],
    opts: PrepareScreenshotOptions
): PrepareScreenshotResult {
    const logger = createDebugLogger(opts, "prepareScreenshot:areas-computation");

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

    const pixelRatio = computePixelRatio(opts.usePixelRatio).pixelRatio;
    const scrollTarget = opts.selectorToScroll ? document.querySelector(opts.selectorToScroll) : null;
    const scrollElement = scrollTarget ?? getCommonScrollParent(selectorsToCapture);

    const ignoreAreas = computeIgnoreAreas(opts.ignoreSelectors).ignoreAreas;
    const captureSpecs = computeCaptureSpecs(selectorsToCapture, logger).captureSpecs;
    const viewportSize = computeViewportSize().viewportSize;
    const viewportOffset = computeViewportOffset().viewportOffset;
    const safeArea = computeSafeArea(selectorsToCapture, scrollElement, logger).safeArea;
    const scrollOffset = computeScrollOffset(scrollElement);

    const documentSize = computeDocumentSize().documentSize;
    const canHaveCaret = computeCanHaveCaret().canHaveCaret;

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
