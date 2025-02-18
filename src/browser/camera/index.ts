import _ from "lodash";
import { Image } from "../../image";
import * as utils from "./utils";

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

    async captureViewportImage(page?: PageMeta): Promise<Image> {
        const base64 = await this._takeScreenshot();
        const image = Image.fromBase64(base64);

        const { width, height } = await image.getSize();
        const imageArea: ImageArea = { left: 0, top: 0, width, height };

        const calibratedArea = this._calibrateArea(imageArea);
        const viewportCroppedArea = this._cropAreaToViewport(calibratedArea, page);

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

    private _cropAreaToViewport(imageArea: ImageArea, page?: PageMeta): ImageArea {
        if (!page) {
            return imageArea;
        }

        const isFullPage = utils.isFullPage(imageArea, page, this._screenshotMode);
        const cropArea = _.clone(page.viewport);

        if (!isFullPage) {
            _.extend(cropArea, { top: 0, left: 0 });
        }

        return {
            left: imageArea.left + cropArea.left,
            top: imageArea.top + cropArea.top,
            width: Math.min(imageArea.width - cropArea.left, cropArea.width),
            height: Math.min(imageArea.height - cropArea.top, cropArea.height),
        };
    }
}
