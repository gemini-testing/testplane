'use strict';
const Promise = require('bluebird');
const Viewport = require('./viewport');
const HeightViewportError = require('./viewport/coord-validator/errors/height-viewport-error');
module.exports = class ScreenShooter {
    static create(browser) {
        return new ScreenShooter(browser);
    }
    constructor(browser) {
        this._browser = browser;
    }
    capture(page, opts = {}) {
        const { allowViewportOverflow, compositeImage, screenshotDelay, selectorToScroll } = opts;
        const viewportOpts = { allowViewportOverflow, compositeImage };
        const cropImageOpts = { screenshotDelay, compositeImage, selectorToScroll };
        return this._browser.captureViewportImage(page, screenshotDelay)
            .then((viewportImage) => Viewport.create(page.viewport, viewportImage, page.pixelRatio, viewportOpts))
            .then((viewport) => this._cropImage(viewport, page, cropImageOpts));
    }
    _cropImage(viewport, page, opts) {
        try {
            viewport.validate(page.captureArea, this._browser);
        }
        catch (e) {
            return e instanceof HeightViewportError && opts.compositeImage
                ? this._extendImage(viewport, page, opts)
                : Promise.reject(e);
        }
        viewport.ignoreAreas(page.ignoreAreas);
        return viewport.crop(page.captureArea);
    }
    _extendImage(viewport, page, opts) {
        const scrollHeight = Math.min(viewport.getVerticalOverflow(page.captureArea), page.viewport.height);
        return this._browser
            .scrollBy({ x: 0, y: scrollHeight, selector: opts.selectorToScroll })
            .then(() => {
            page.viewport.top += scrollHeight;
            return this._browser.captureViewportImage(page, opts.screenshotDelay);
        })
            .then((newImage) => viewport.extendBy(scrollHeight, newImage))
            .then(() => this._cropImage(viewport, page, opts));
    }
};
