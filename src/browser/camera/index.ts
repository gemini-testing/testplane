import _ from "lodash";
import { Image } from "../../image";
import * as utils from "./utils";
import makeDebug from "debug";

const debug = makeDebug("testplane:screenshots:camera");

export interface ImageArea {
    left: number;
    top: number;
    width: number;
    height: number;
}

export type ScreenshotMode = "fullpage" | "viewport" | "auto";

export interface PageMeta {
    viewport: ImageArea;
    documentHeight: number;
    documentWidth: number;
}

interface Calibration {
    left: number;
    top: number;
}

export class Camera {
    private _screenshotMode: ScreenshotMode;
    private _takeScreenshot: () => Promise<string>;
    private _calibration: Calibration | null;

    static create(screenshotMode: ScreenshotMode, takeScreenshot: () => Promise<string>): Camera {
        return new this(screenshotMode, takeScreenshot);
    }

    constructor(screenshotMode: ScreenshotMode, takeScreenshot: () => Promise<string>) {
        this._screenshotMode = screenshotMode;
        this._takeScreenshot = takeScreenshot;
        this._calibration = null;
    }

    calibrate(calibration: Calibration): void {
        this._calibration = calibration;
    }

    /** @param viewport - Current state of the viewport. Top/left denote scroll offsets, width/height denote viewport size. */
    async captureViewportImage(viewport?: ImageArea): Promise<Image> {
        const base64 = await this._takeScreenshot();
        const image = Image.fromBase64(base64);

        const { width, height } = await image.getSize();
        const imageArea: ImageArea = { left: 0, top: 0, width, height };

        const calibratedArea = this._calibrateArea(imageArea);
        const viewportCroppedArea = this._cropAreaToViewport(calibratedArea, viewport);

        if (viewportCroppedArea.width !== width || viewportCroppedArea.height !== height) {
            await image.crop(viewportCroppedArea);
        }

        return image;
    }

    private _calibrateArea(imageArea: ImageArea): ImageArea {
        if (!this._calibration) {
            return imageArea;
        }

        const { left, top } = this._calibration;

        return { left, top, width: imageArea.width - left, height: imageArea.height - top };
    }

    /* On some browsers, e.g. older firefox versions, the screenshot returned by the browser can be the whole page
       (even beyond the viewport, potentially spanning thousands of pixels down).
       This function is used to detect such cases and crop the image to the viewport, always. */
    private _cropAreaToViewport(imageArea: ImageArea, viewport?: ImageArea): ImageArea {
        if (!viewport) {
            return imageArea;
        }

        const isFullPage = utils.isFullPage(imageArea, viewport, this._screenshotMode);
        const cropArea = _.clone(viewport);

        if (!isFullPage) {
            _.extend(cropArea, { top: 0, left: 0 });
        }
        debug(
            "cropping area to viewport. imageArea: %O, viewport: %O, cropArea: %O, isFullPage: %s",
            imageArea,
            viewport,
            cropArea,
            isFullPage,
        );

        return utils.getIntersection(imageArea, cropArea);
    }
}
