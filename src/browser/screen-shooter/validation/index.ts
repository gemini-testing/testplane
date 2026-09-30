import { AssertViewOpts } from "../../../config/types";
import { getVerticalOverflowErrorMessage } from "../errors/vertical-overflow-error";
import { getHorizontalOverflowErrorMessage } from "../errors/horizontal-overflow-error";
import { PixelRatioChangeError } from "../errors/pixel-ratio-change-error";
import * as logger from "../../../utils/logger";
import { Point, Rect, Size, getCoveringRect, prettySize } from "../../isomorphic";

export const assertPixelRatio = (
    imageSize: Size<"device">,
    viewportSize: Size<"device">,
    viewportSizeInCss: Size<"css">,
): void => {
    // Allow rounding differences between CSS geometry and the captured bitmap.
    if (Math.abs(imageSize.width - viewportSize.width) <= 1 && Math.abs(imageSize.height - viewportSize.height) <= 1) {
        return;
    }

    const pixelRatio = imageSize.width / viewportSizeInCss.width;
    if (Math.abs(imageSize.height - viewportSizeInCss.height * pixelRatio) > 1) {
        throw new Error(
            `Screenshot dimensions do not match the viewport at a consistent pixel ratio. ` +
                `imageSize: ${prettySize(imageSize)}, viewportSize: ${prettySize(viewportSize)}`,
        );
    }

    const roundedPixelRatio = Math.round(pixelRatio);
    const PIXEL_RATIO_EPSILON = 0.001;
    // Compare bounds directly to avoid subtraction rounding at the tolerance boundary.
    const shouldSnap =
        roundedPixelRatio > 0 &&
        pixelRatio >= roundedPixelRatio - PIXEL_RATIO_EPSILON &&
        pixelRatio <= roundedPixelRatio + PIXEL_RATIO_EPSILON;
    const finalPixelRatio = shouldSnap ? roundedPixelRatio : pixelRatio;

    throw new PixelRatioChangeError(finalPixelRatio);
};

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
