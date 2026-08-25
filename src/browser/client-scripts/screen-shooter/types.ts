import { BrowserSideError, Coord, DisableHoverMode, Point, Rect, Size, Space, Unit, YBand } from "@isomorphic";
import type { ElementTarget } from "@lib";

export interface CaptureSpec<S extends Space, U extends Unit> {
    /** Full element rect, unconstrained by ancestor overflow clipping */
    full: Rect<S, U>;
    /** Clip rect used to compute visible portion */
    clip: Rect<S, U>;
    /** Visible portion: full rect intersected with all ancestor overflow clip boundaries */
    visible: Rect<S, U>;
}

export interface TrackedElementData {
    element: Element;
    /** baseline element rect in viewport CSS coordinates */
    rect: Rect<"viewport", "css">;
}

export interface ViewportState {
    viewportSize: Size<"device">;
    viewportOffset: Point<"page", "device">;
    documentSize: Size<"device">;
    pixelRatio: number;
}

export interface CaptureState extends ViewportState {
    scrollOffset: Coord<"page", "device", "y">;
    captureSpecs: CaptureSpec<"viewport", "device">[];
    ignoreAreas: Rect<"viewport", "device">[];
    safeArea: YBand<"viewport", "device">;
    /** Observed viewport-space vertical movement of tracked elements vs baseline, in device px. */
    anchorShift: number | null;
}

export interface SavedScrollPosition {
    element: Element;
    left: number;
    top: number;
}

export interface ScreenshooterNamespaceData {
    cleanupPointerEventsCb?: () => void;
    savedScrollPositions?: SavedScrollPosition[];
    trackedElementsData?: TrackedElementData[];
}

export interface PrepareScreenshotOptions {
    ignoreSelectors?: ElementTarget[];
    allowViewportOverflow?: boolean;
    captureElementFromTop?: boolean;
    selectorToScroll?: ElementTarget;
    disableAnimation?: boolean;
    disableHover?: DisableHoverMode;
    compositeImage?: boolean;
    debug?: string[];
    usePixelRatio?: boolean;
    pixelRatioOverride?: number;
}

export interface PrepareScreenshotSuccess extends CaptureState {
    // Whether the document.activeElement is likely editable (e.g. input, textarea, etc.)
    canHaveCaret: boolean;
    // Whether pointer-events were disabled during prepareScreenshot. Useful for "when-scrolling-needed", because in that case it's determined on browser side
    pointerEventsDisabled?: boolean;
    // Debug log, returned only if DEBUG env includes scope "testplane:screenshots:browser:prepareScreenshot"
    debugLog?: string;
    // Description of the element that is being scrolled, used for human-readable errors
    readableSelectorToScrollDescr?: string;
}

export type PrepareScreenshotResult = PrepareScreenshotSuccess | BrowserSideError;

export interface ScrollToCaptureSpecResult {
    readableSelectorToScrollDescr?: string;
}

export type ElementPositionsProbe<U extends Unit> = (Rect<"viewport", U> & { elementDescr?: string }) | null;

export interface PrepareFullPageScreenshotSuccess extends ViewportState {
    safeArea: YBand<"viewport", "device">;
    elementPositionsProbe: ElementPositionsProbe<"device">[];
    pointerEventsDisabled?: boolean;
}

export type PrepareFullPageScreenshotResult = PrepareFullPageScreenshotSuccess | BrowserSideError;

export interface ScrollFullPageSuccess {
    viewportOffset: Point<"page", "device">;
    elementPositionsProbe: ElementPositionsProbe<"device">[];
}

export interface PrepareViewportScreenshotSuccess extends ViewportState {
    ignoreAreas: Rect<"viewport", "device">[];
    canHaveCaret: boolean;
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
