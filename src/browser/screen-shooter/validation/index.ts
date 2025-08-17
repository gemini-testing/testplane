import { AssertViewOpts } from "../../../config/types";
import { Point, Rect, Size } from "../../../image";
import { VerticalOverflowError } from "../errors/vertical-overflow-error";
import { HorizontalOverflowError } from "../errors/horizontal-overflow-error";

const isOutsideOfViewportHorizontally = (viewport: Size, cropArea: Rect): boolean =>
    cropArea.top < 0 || cropArea.left < 0 || cropArea.left + cropArea.width > viewport.width;

export const assertCorrectCaptureAreaBounds = (readableCaptureAreaDescr: string, viewportSize: Size, viewportOffset: Point, captureArea: Rect, opts: AssertViewOpts): void => {
    if (opts.allowViewportOverflow && !opts.compositeImage) {
        return;
    }

    if (!opts.allowViewportOverflow && isOutsideOfViewportHorizontally(viewportSize, captureArea)) {
        throw new HorizontalOverflowError(readableCaptureAreaDescr, captureArea, viewportSize);
    }

    if (captureArea.top + captureArea.height > viewportOffset.top + viewportSize.height) {
        if (opts.compositeImage) {
            return;
        }
        throw new VerticalOverflowError(readableCaptureAreaDescr, captureArea, viewportSize);
    }
};
