import { Point, Rect } from "../../image";

export interface PrepareScreenshotResult {
    // Element boundaries in global page coordinates. May overflow viewport
    captureArea: Rect;
    // Area free of sticky elements, inside which it's safe to capture element that's interesting to us
    // Measured relative to browser viewport (not the whole page!)
    safeArea: Rect;
    // Current scroll position of the scroll element, if window is being used, this will always be 0
    scrollElementOffset: Point;
    // Boundaries of elements that we should ignore when comparing screenshots (these areas will be painted in black)
    ignoreAreas: Rect[];
    // Viewport size
    // TODO: rename to viewportSize in the future. Right now there are way too many places that are using this field
    // Do not rely on top/left values of this field, they are deprecated!
    viewport: Rect;
    // Viewport scroll offsets, window.scrollX / window.scrollY respectively
    viewportOffset: Point;
    // Total height of the document, may be larger than viewport
    // TODO: merge these into documentSize. Right now there are way too many places that depend on this
    documentHeight: number;
    // Total width of the document, may be larger than viewport
    documentWidth: number;
    // Whether the document.activeElement is likely editable (e.g. input, textarea, etc.)
    canHaveCaret: boolean;
    // Pixel ratio: window.devicePixelRatio or 1 if usePixelRatio was set to false
    pixelRatio: number;
    // Debug log, returned only if DEBUG env includes scope "testplane:screenshots:browser:prepareScreenshot"
    debugLog?: string;
}
