"use strict";

const _ = require("lodash");

const CoordValidator = require("./coord-validator");

module.exports = class Viewport {
    static create(...args) {
        return new this(...args);
    }

    constructor(page, image, opts) {
        this._pixelRatio = page.pixelRatio;
        this._viewport = this._scale(page.viewport);
        this._captureArea = this._scale(this._sanitize(page.captureArea));
        this._ignoreAreas = page.ignoreAreas.map(area => this._scale(area));
        this._image = image;
        this._opts = opts;
        this._summaryHeight = 0;
    }

    validate(browser) {
        const coordValidator = CoordValidator.create(browser, this._opts);

        return coordValidator.validate(this._viewport, this._captureArea);
    }

    async ignoreAreas(image, imageArea) {
        for (const area of this._ignoreAreas) {
            const imageClearArea = this._getIntersection(area, imageArea);

            if (imageClearArea !== null) {
                await image.addClear(this._shiftArea(imageClearArea, { left: -imageArea.left, top: -imageArea.top }));
            }
        }

        image.applyClear();
    }

    async handleImage(image, area = {}) {
        const { width, height } = await image.getSize();
        _.defaults(area, { left: 0, top: 0, width, height });
        const capturedArea = this._transformToCaptureArea(area);

        await this.ignoreAreas(image, this._shiftArea(capturedArea, { left: -area.left, top: -area.top }));
        await image.crop(this._sanitize(this._transformToViewportOrigin(capturedArea)));

        this._summaryHeight += capturedArea.height;
    }

    async composite() {
        await this._image.applyJoin();

        return this._image;
    }

    async save(path) {
        return this._image.save(path);
    }

    async extendBy(scrollHeight, newImage) {
        const physicalScrollHeight = scrollHeight * this._pixelRatio;
        this._viewport.height += physicalScrollHeight;
        const { width, height } = await newImage.getSize();

        await this.handleImage(newImage, {
            left: 0,
            top: height - physicalScrollHeight,
            width,
            height: physicalScrollHeight,
        });

        this._image.addJoin(newImage);
    }

    getVerticalOverflow() {
        return (getAreaBottom(this._captureArea) - getAreaBottom(this._viewport)) / this._pixelRatio;
    }

    _scale(area, scaleFactor = this._pixelRatio) {
        return {
            left: area.left * scaleFactor,
            top: area.top * scaleFactor,
            width: area.width * scaleFactor,
            height: area.height * scaleFactor,
        };
    }

    _sanitize(area) {
        return {
            left: Math.max(area.left, 0),
            top: Math.max(area.top, 0),
            width: Math.max(area.width, 0),
            height: Math.max(area.height, 0),
        };
    }

    _getIntersection(...areas) {
        const top = Math.max(...areas.map(area => area.top));
        const bottom = Math.min(...areas.map(getAreaBottom));
        const left = Math.max(...areas.map(area => area.left));
        const right = Math.min(...areas.map(getAreaRight));

        if (left >= right || top >= bottom) {
            return null;
        }

        return { left, top, width: right - left, height: bottom - top };
    }

    _shiftArea(area, { left, top } = {}) {
        left = left || 0;
        top = top || 0;

        return {
            left: area.left + left,
            top: area.top + top,
            width: area.width,
            height: area.height,
        };
    }

    _transformToCaptureArea(area) {
        const shiftX = area.left - this._viewport.left;
        const shiftY = area.top - this._viewport.top;
        const shiftedImageArea = this._shiftArea(area, { top: this._summaryHeight });
        const shiftedCaptureArea = this._sanitize(this._shiftArea(this._captureArea, { left: shiftX, top: shiftY }));
        const intersectingArea = this._getIntersection(shiftedImageArea, shiftedCaptureArea) || shiftedImageArea;

        return this._shiftArea(intersectingArea, { left: this._viewport.left, top: this._viewport.top });
    }

    _transformToViewportOrigin(area) {
        return this._shiftArea(area, { left: -this._viewport.left, top: -this._viewport.top - this._summaryHeight });
    }
};

function getAreaBottom(area) {
    return area.top + area.height;
}

function getAreaRight(area) {
    return area.left + area.width;
}
