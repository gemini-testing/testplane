import { Image } from "../../image";
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
export declare class Camera {
    private _screenshotMode;
    private _takeScreenshot;
    private _calibration;
    static create(screenshotMode: ScreenshotMode, takeScreenshot: () => Promise<string>): Camera;
    constructor(screenshotMode: ScreenshotMode, takeScreenshot: () => Promise<string>);
    calibrate(calibration: Calibration): void;
    captureViewportImage(page?: PageMeta): Promise<Image>;
    private _calibrateArea;
    private _cropAreaToViewport;
}
export {};
