import os from "node:os";
import path from "node:path";
import makeDebug from "debug";

import { Image } from "../../image";
import * as utils from "./utils";
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

export interface CaptureViewportImageOpts {
    viewportOffset: Point<"page", "device">;
    viewportSize: Size<"device">;
    /** Delay before taking the screenshot, in milliseconds. */
    screenshotDelay?: number;
}

export class Camera {
    private _screenshotMode: ScreenshotMode;
    private _takeScreenshot: () => Promise<string>;
    private _calibratedArea: Rect<"image", "device"> | null;
    private _debugTmpDir: string | null = null;

    static create(screenshotMode: ScreenshotMode, takeScreenshot: () => Promise<string>): Camera {
        return new this(screenshotMode, takeScreenshot);
    }

    constructor(screenshotMode: ScreenshotMode, takeScreenshot: () => Promise<string>) {
        this._screenshotMode = screenshotMode;
        this._takeScreenshot = takeScreenshot;
        this._calibratedArea = null;

        if (process.env.TESTPLANE_DEBUG_SCREENSHOTS) {
            this._debugTmpDir = path.join(
                os.tmpdir(),
                `testplane-camera-viewports-${Math.random().toString(36).slice(2)}`,
            );
            console.log("Debug camera images will be saved to: ", this._debugTmpDir);
        }
    }

    calibrate(calibratedArea: Rect<"image", "device">): void {
        debug("Setting calibrated area: %O", calibratedArea);
        this._calibratedArea = calibratedArea;
    }

    async captureViewportImage(opts?: CaptureViewportImageOpts): Promise<Image> {
        if (opts?.screenshotDelay) {
            await new Promise(resolve => setTimeout(resolve, opts.screenshotDelay));
        }

        const base64 = await this._takeScreenshot();
        const image = Image.fromBase64(base64);

        const { width, height } = (await image.getSize()) as Size<"device">;
        const imageArea: Rect<"image", "device"> = {
            left: 0 as Coord<"image", "device", "x">,
            top: 0 as Coord<"image", "device", "y">,
            width,
            height,
        };

        const calibratedArea = this._cropAreaToCalibratedArea(imageArea);

        const viewportCroppedArea = this._cropAreaToViewport(calibratedArea, { width, height }, opts);
        await utils.saveViewportImageForDebugIfNeeded(image, calibratedArea, this._debugTmpDir);

        if (viewportCroppedArea.width !== width || viewportCroppedArea.height !== height) {
            await image.crop(viewportCroppedArea);
        }

        return image;
    }

    private _cropAreaToCalibratedArea(imageArea: Rect<"image", "device">): Rect<"image", "device"> {
        if (!this._calibratedArea) {
            return imageArea;
        }

        const intersection = getIntersection(imageArea, this._calibratedArea);
        if (intersection === null) {
            logger.warn(
                `No intersection found between image area and calibrated viewport area, falling back to original image area.\n` +
                    `imageArea: ${prettyRect(imageArea)}, calibratedViewportArea: ${prettyRect(
                        this._calibratedArea,
                    )}\n` +
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
        opts?: CaptureViewportImageOpts,
    ): Rect<"image", "device"> {
        if (!opts?.viewportSize || !opts?.viewportOffset) {
            return imageAreaToCrop;
        }

        const isFullPage = utils.isFullPage(
            imageAreaToCrop,
            originalImageSize,
            this._calibratedArea ?? imageAreaToCrop,
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
