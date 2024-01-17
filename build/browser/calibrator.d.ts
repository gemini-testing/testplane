export = Calibrator;
declare class Calibrator {
    _cache: {};
    /**
     * @param {Browser} browser
     * @returns {Promise.<CalibrationResult>}
     */
    calibrate(browser: Browser): Promise<CalibrationResult>;
    _analyzeImage(image: any, params: any): Promise<{
        viewportStart: {
            x: number;
            y: any;
        };
    } | null>;
}
