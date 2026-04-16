import { BrowserSideError, Coord, DisableHoverMode, Point, Rect, Size, Space, Unit, YBand } from "@isomorphic";

export interface CaptureSpec<S extends Space, U extends Unit> {
    /** Full element rect, unconstrained by ancestor overflow clipping */
    full: Rect<S, U>;
    /** Visible portion: full rect intersected with all ancestor overflow clip boundaries */
    visible: Rect<S, U>;
}

export interface CaptureState {
    scrollOffset: Coord<"page", "device", "y">;
    captureSpecs: CaptureSpec<"viewport", "device">[];
    ignoreAreas: Rect<"viewport", "device">[];
    safeArea: YBand<"viewport", "device">;
}

export interface SavedScrollPosition {
    element: Element;
    left: number;
    top: number;
}

export interface ScreenshooterNamespaceData {
    cleanupPointerEventsCb?: () => void;
    savedScrollPositions?: SavedScrollPosition[];
}

export interface PrepareScreenshotOptions {
    ignoreSelectors?: string[];
    allowViewportOverflow?: boolean;
    captureElementFromTop?: boolean;
    selectorToScroll?: string;
    disableAnimation?: boolean;
    disableHover?: DisableHoverMode;
    compositeImage?: boolean;
    debug?: string[];
    usePixelRatio?: boolean;
}

export interface PrepareScreenshotSuccess {
    // Area free of sticky elements, inside which it's safe to capture element that's interesting to us
    // Measured relative to browser viewport (not the whole page!)
    safeArea: YBand<"viewport", "device">;
    // Boundaries of elements that we should ignore when comparing screenshots (these areas will be painted in black)
    ignoreAreas: Rect<"viewport", "device">[];
    // Element capture areas with full (unconstrained) and visible (clipped by ancestor overflow) rects
    captureSpecs: CaptureSpec<"viewport", "device">[];
    // Viewport size
    viewportSize: Size<"device">;
    // Viewport scroll offsets, window.scrollX / window.scrollY respectively
    viewportOffset: Point<"page", "device">;
    // Total height of the document, may be larger than viewport
    documentSize: Size<"device">;
    // Whether the document.activeElement is likely editable (e.g. input, textarea, etc.)
    canHaveCaret: boolean;
    // Pixel ratio: window.devicePixelRatio or 1 if usePixelRatio was set to false
    pixelRatio: number;
    // Whether pointer-events were disabled during prepareScreenshot. Useful for "when-scrolling-needed", because in that case it's determined on browser side
    pointerEventsDisabled?: boolean;
    // Debug log, returned only if DEBUG env includes scope "testplane:screenshots:browser:prepareScreenshot"
    debugLog?: string;
    // Description of the element that is being scrolled, used for human-readable errors
    readableSelectorToScrollDescr?: string;
    // Current vertical scroll offset of the resolved scroll element (or window/document root)
    scrollOffset: Coord<"page", "device", "y">;
}

export type PrepareScreenshotResult = PrepareScreenshotSuccess | BrowserSideError;

export interface ScrollToCaptureSpecResult {
    readableSelectorToScrollDescr?: string;
}

export type ElementPositionsProbe<U extends Unit> = Array<Rect<"viewport", U> | null>;

export interface PrepareFullPageScreenshotSuccess {
    documentSize: Size<"device">;
    viewportSize: Size<"device">;
    viewportOffset: Point<"page", "device">;
    safeArea: YBand<"viewport", "device">;
    elementPositionsProbe: ElementPositionsProbe<"device">;
    pixelRatio: number;
    pointerEventsDisabled?: boolean;
}

export type PrepareFullPageScreenshotResult = PrepareFullPageScreenshotSuccess | BrowserSideError;

export interface ScrollFullPageSuccess {
    viewportOffset: Point<"page", "device">;
    elementPositionsProbe: ElementPositionsProbe<"device">;
}

export interface PrepareViewportScreenshotSuccess {
    viewportSize: Size<"device">;
    viewportOffset: Point<"page", "device">;
    documentSize: Size<"device">;
    canHaveCaret: boolean;
    pixelRatio: number;
    pointerEventsDisabled?: boolean;
}

export type PrepareViewportScreenshotResult = PrepareViewportScreenshotSuccess | BrowserSideError;

export type ScrollFullPageResult = ScrollFullPageSuccess | BrowserSideError;

export type ScrollResult =
    | {
          readableSelectorToScrollDescr?: string;
          debugLog?: string;
      }
    | BrowserSideError;

export type GetCaptureStateResult =
    | (CaptureState & {
          readableSelectorToScrollDescr?: string;
          debugLog?: string;
      })
    | BrowserSideError;
