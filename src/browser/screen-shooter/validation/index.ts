import { AssertViewOpts } from "../../../config/types";
import { getVerticalOverflowErrorMessage } from "../errors/vertical-overflow-error";
import { getHorizontalOverflowErrorMessage } from "../errors/horizontal-overflow-error";
import * as logger from "../../../utils/logger";
import { Point, Rect, Size, getCoveringRect } from "../../isomorphic";

const isOutsideOfViewportHorizontally = (viewport: Size<"device">, cropArea: Rect<"viewport", "device">): boolean =>
    cropArea.left < 0 || cropArea.left + cropArea.width > viewport.width;

export const assertCorrectCaptureAreaBounds = (
    readableCaptureAreaDescr: string,
    viewportSize: Size<"device">,
    viewportOffset: Point<"page", "device">,
    captureAreas: Rect<"viewport", "device">[],
    opts: AssertViewOpts,
): void => {
    if (opts.allowViewportOverflow && !opts.compositeImage) {
        return;
    }

    const captureArea = getCoveringRect(captureAreas);

    if (!opts.allowViewportOverflow && isOutsideOfViewportHorizontally(viewportSize, captureArea)) {
        logger.warn(getHorizontalOverflowErrorMessage(readableCaptureAreaDescr, captureArea, viewportSize));
    }

    if (captureArea.top + captureArea.height > viewportOffset.top + viewportSize.height) {
        if (opts.compositeImage || opts.allowViewportOverflow) {
            return;
        }
        logger.warn(getVerticalOverflowErrorMessage(readableCaptureAreaDescr, captureArea, viewportSize));
    }
};
