export = Calibrator;
declare class Calibrator {
    _cache: {};
    _script: string;
    /**
     * @param {Browser} browser
     * @returns {Promise.<CalibrationResult>}
     */
    calibrate(browser: Browser): Promise<CalibrationResult>;
    _analyzeImage(image: any, params: any): globalThis.Promise<{
        viewportStart: {
            x: number;
            y: any;
        };
    } | null>;
}
import Promise = require("bluebird");
