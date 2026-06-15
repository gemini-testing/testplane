import os from "node:os";
import path from "node:path";
import makeDebug from "debug";

import { Image } from "../../image";
import * as utils from "./utils";
import type { CropMargins } from "./utils";
import * as logger from "../../utils/logger";
import {
    getIntersection,
    type Coord,
    type Point,
    type Rect,
    type Size,
    prettyRect,
    prettySize,
    prettyPoint,
} from "../isomorphic/geometry";
import { NEW_ISSUE_LINK } from "../../constants/help";

const debug = makeDebug("testplane:screenshots:camera");

export type ScreenshotMode = "fullpage" | "viewport" | "auto";
export type { CropMargins } from "./utils";

export interface CaptureViewportImageOpts {
    viewportOffset: Point<"page", "device">;
    viewportSize: Size<"device">;
    /** Delay before taking the screenshot, in milliseconds. */
    screenshotDelay?: number;
    /** Additional raw screenshot margins to crop, in physical pixels. */
    cropMargins?: CropMargins;
}

export class Camera {
    private _screenshotMode: ScreenshotMode;
    private _takeScreenshot: () => Promise<string>;
    private _calibratedArea: Rect<"image", "device"> | null;
    private _calibrationScreenshotSize: Size<"device"> | null;
    private _debugTmpDir: string | null = null;

    static create(screenshotMode: ScreenshotMode, takeScreenshot: () => Promise<string>): Camera {
        return new this(screenshotMode, takeScreenshot);
    }

    constructor(screenshotMode: ScreenshotMode, takeScreenshot: () => Promise<string>) {
        this._screenshotMode = screenshotMode;
        this._takeScreenshot = takeScreenshot;
        this._calibratedArea = null;
        this._calibrationScreenshotSize = null;

        if (process.env.TESTPLANE_DEBUG_SCREENSHOTS) {
            this._debugTmpDir = path.join(
                os.tmpdir(),
                `testplane-camera-viewports-${Math.random().toString(36).slice(2)}`,
            );
            console.log("Debug camera images will be saved to: ", this._debugTmpDir);
        }
    }

    calibrate(calibratedArea: Rect<"image", "device">, screenshotSize: Size<"device">): void {
        debug("Setting calibrated area: %O for screenshot size: %O", calibratedArea, screenshotSize ?? null);
        this._calibratedArea = calibratedArea;
        this._calibrationScreenshotSize = screenshotSize;
    }

    async captureViewportImage(opts?: CaptureViewportImageOpts): Promise<Image> {
        if (opts?.screenshotDelay) {
            await new Promise(resolve => setTimeout(resolve, opts.screenshotDelay));
        }

        const base64 = await this._takeScreenshot();
        const image = Image.fromBase64(base64);

        const { width, height } = image.getSize() as Size<"device">;
        const imageArea: Rect<"image", "device"> = {
            left: 0 as Coord<"image", "device", "x">,
            top: 0 as Coord<"image", "device", "y">,
            width,
            height,
        };

        const shouldApplyCalibration =
            this._calibrationScreenshotSize !== null &&
            this._calibrationScreenshotSize.width === width &&
            this._calibrationScreenshotSize.height === height;
        const calibrationArea = shouldApplyCalibration ? this._calibratedArea : null;

        const calibratedImageArea = this._cropAreaToIntersection(imageArea, calibrationArea);
        const cropMarginsArea = utils.cropMarginsToRect(imageArea, opts?.cropMargins);
        const croppedImageArea = getIntersection(calibratedImageArea, cropMarginsArea);
        if (croppedImageArea === null) {
            throw new Error(
                `Invalid cropMargins option: resulting screenshot crop area is empty. ` +
                    `imageSize: ${prettySize(imageArea)}, cropMargins: ${JSON.stringify(opts?.cropMargins ?? {})}`,
            );
        }

        const viewportCroppedArea = this._cropAreaToViewport(
            croppedImageArea,
            { width, height },
            croppedImageArea,
            opts,
        );
        await utils.saveViewportImageForDebugIfNeeded(image, croppedImageArea, this._debugTmpDir);

        if (viewportCroppedArea.width !== width || viewportCroppedArea.height !== height) {
            await image.crop(viewportCroppedArea);
        }

        return image;
    }

    private _cropAreaToIntersection(
        imageArea: Rect<"image", "device">,
        cropArea: Rect<"image", "device"> | null,
    ): Rect<"image", "device"> {
        if (!cropArea) {
            return imageArea;
        }

        const intersection = getIntersection(imageArea, cropArea);
        if (intersection === null) {
            logger.warn(
                `No intersection found between image area and crop area, falling back to original image area.\n` +
                    `imageArea: ${prettyRect(imageArea)}, cropArea: ${prettyRect(cropArea)}\n` +
                    `This likely means Testplane incorrectly determined area free of system UI elements. You can let us know at ${NEW_ISSUE_LINK}, providing this log and browser used.`,
            );

            return imageArea;
        }

        return intersection;
    }

    /* On some browsers, e.g. older firefox versions, the screenshot returned by the browser can be the whole page
       (even beyond the viewport, potentially spanning thousands of pixels down).
       This function is used to detect such cases and crop the image to the viewport, always. */
    private _cropAreaToViewport(
        imageAreaToCrop: Rect<"image", "device">,
        originalImageSize: Size<"device">,
        calibrationArea: Rect<"image", "device"> | null,
        opts?: CaptureViewportImageOpts,
    ): Rect<"image", "device"> {
        if (!opts?.viewportSize || !opts?.viewportOffset) {
            return imageAreaToCrop;
        }

        const isFullPage = utils.isFullPage(
            imageAreaToCrop,
            originalImageSize,
            calibrationArea ?? imageAreaToCrop,
            this._screenshotMode,
        );
        const cropArea = { ...opts.viewportSize, ...opts.viewportOffset };

        if (!isFullPage) {
            return imageAreaToCrop;
        }
        debug(
            "cropping area to viewport.\n  imageArea: %O\n  viewportSize: %O\n  viewportOffset: %O\n  cropArea: %O\n  isFullPage: %s\n  screenshotMode: %s\n  documentSize: %O",
            imageAreaToCrop,
            opts.viewportSize,
            opts.viewportOffset,
            cropArea,
            isFullPage,
            this._screenshotMode,
        );

        const result = getIntersection(imageAreaToCrop, cropArea);
        if (result === null) {
            logger.warn(
                `No intersection found between image area and viewport area, falling back to original image area.\n` +
                    `imageArea: ${prettyRect(imageAreaToCrop)},\n` +
                    `viewportSize: ${prettySize(opts.viewportSize)},\n` +
                    `viewportOffset: ${prettyPoint(opts.viewportOffset)}\n` +
                    `This likely means Testplane incorrectly determined whether returned image is full page and viewport state. You can let us know at ${NEW_ISSUE_LINK}, providing this log and browser used.`,
            );

            return imageAreaToCrop;
        }

        return result;
    }
}
