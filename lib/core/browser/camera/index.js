'use strict';

const Image = require('../../image');
const _ = require('lodash');
const utils = require('./utils');

module.exports = class Camera {
    static create(screenshotMode, takeScreenshot) {
        return new this(screenshotMode, takeScreenshot);
    }

    constructor(screenshotMode, takeScreenshot) {
        this._screenshotMode = screenshotMode;
        this._takeScreenshot = takeScreenshot;
        this._calibration = null;
    }

    calibrate(calibration) {
        this._calibration = calibration;
    }

    captureViewportImage(page) {
        return this._takeScreenshot()
            .then((base64) => this._applyCalibration(Image.fromBase64(base64)))
            .then((image) => this._cropToViewport(image, page));
    }

    _applyCalibration(image) {
        if (!this._calibration) {
            return image;
        }

        const {left, top} = this._calibration;
        const {width, height} = image.getSize();

        return image.crop({left, top, width: width - left, height: height - top});
    }

    _cropToViewport(image, page) {
        if (!page) {
            return image;
        }

        const isFullPage = utils.isFullPage(image, page, this._screenshotMode);
        const cropArea = _.clone(page.viewport);

        if (!isFullPage) {
            _.extend(cropArea, {
                top: 0,
                left: 0
            });
        }

        return image.crop(cropArea, {scaleFactor: page.pixelRatio});
    }
};
