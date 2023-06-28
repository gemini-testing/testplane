export = Camera;
declare class Camera {
    static create(screenshotMode: any, takeScreenshot: any): import(".");
    constructor(screenshotMode: any, takeScreenshot: any);
    _screenshotMode: any;
    _takeScreenshot: any;
    _calibration: any;
    calibrate(calibration: any): void;
    captureViewportImage(page: any): Promise<Image>;
    _calibrateArea(imageArea: any): any;
    _cropAreaToViewport(imageArea: any, page: any): any;
}
import Image = require("../../image");
