import { Rect } from "../../image";

export interface PrepareScreenshotResult {
    // Element boundaries in global page coordinates. May overflow viewport
    captureArea: Rect;
    // Boundaries of elements that we should ignore when comparing screenshots (these areas will be painted in black)
    ignoreAreas: Rect[];
    // Current viewport state: height and width. Top (and left correspondingly) represents scroll position:
    // window.pageYOffset or element.scrollTop if selectorToScroll was specified
    viewport: Rect;
    // Total height of the document, may be larger than viewport
    documentHeight: number;
    // Total width of the document, may be larger than viewport
    documentWidth: number;
    // Whether the document.activeElement is likely editable (e.g. input, textarea, etc.)
    canHaveCaret: boolean;
    // Pixel ratio: window.devicePixelRatio or 1 if usePixelRatio was set to false
    pixelRatio: number;
}
