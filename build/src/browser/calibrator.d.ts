import { ExistingBrowser } from "./existing-browser";
interface BrowserFeatures {
    needsCompatLib: boolean;
    pixelRatio: number;
    innerWidth: number;
}
export interface CalibrationResult extends BrowserFeatures {
    top: number;
    left: number;
    usePixelRatio: boolean;
}
export declare class Calibrator {
    private _cache;
    private _script;
    constructor();
    calibrate(browser: ExistingBrowser): Promise<CalibrationResult>;
    private _analyzeImage;
}
export {};
