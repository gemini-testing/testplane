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

    async captureViewportImage(page) {
        const base64 = await this._takeScreenshot();
        const image = Image.fromBase64(base64);

        const {width, height} = await image.getSize();
        const imageArea = {left: 0, top: 0, width, height};

        const calibratedArea = this._calibrateArea(imageArea);
        const viewportCroppedArea = this._cropAreaToViewport(calibratedArea, page);

        if (viewportCroppedArea.width !== width || viewportCroppedArea.height !== height) {
            await image.crop(viewportCroppedArea);
        }

        return image;
    }

    _calibrateArea(imageArea) {
        if (!this._calibration) {
            return imageArea;
        }

        const {left, top} = this._calibration;

        return {left, top, width: imageArea.width - left, height: imageArea.height - top};
    }

    _cropAreaToViewport(imageArea, page) {
        if (!page) {
            return imageArea;
        }

        const isFullPage = utils.isFullPage(imageArea, page, this._screenshotMode);
        const cropArea = _.clone(page.viewport);

        if (!isFullPage) {
            _.extend(cropArea, {top: 0, left: 0});
        }

        return {
            left: (imageArea.left + cropArea.left) * page.pixelRatio,
            top: (imageArea.top + cropArea.top) * page.pixelRatio,
            width: Math.min(imageArea.width - cropArea.left, cropArea.width) * page.pixelRatio,
            height: Math.min(imageArea.height - cropArea.top, cropArea.height) * page.pixelRatio
        };
    }
};
