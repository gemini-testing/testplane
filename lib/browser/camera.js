'use strict';

const {Image} = require('gemini-core');

module.exports = class Camera {
    static create(browser) {
        return new Camera(browser);
    }

    constructor(browser) {
        this._browser = browser;
        this._calibration = null;
    }

    calibrate(calibration) {
        this._calibration = calibration;
    }

    isCalibrated() {
        return Boolean(this._calibration);
    }

    captureViewportImage() {
        const {publicAPI: session} = this._browser;

        return session.screenshot()
            .then((screenData) => {
                const image = Image.fromBase64(screenData.value);

                return this._applyCalibration(image);
            });
    }

    _applyCalibration(image) {
        if (!this._calibration) {
            return image;
        }

        const {left, top} = this._calibration;
        const {width, height} = image.getSize();

        return image.crop({left, top, width: width - left, height: height - top});
    }

    get calibration() {
        return this._calibration;
    }
};
