"use strict";

const Viewport = require("./viewport");

module.exports = class ScreenShooter {
    static create(browser) {
        return new this(browser);
    }

    constructor(browser) {
        this._browser = browser;
    }

    async capture(page, opts = {}) {
        const { allowViewportOverflow, compositeImage, screenshotDelay, selectorToScroll } = opts;
        const viewportOpts = { allowViewportOverflow, compositeImage };
        const cropImageOpts = { screenshotDelay, compositeImage, selectorToScroll };

        const capturedImage = await this._browser.captureViewportImage(page, screenshotDelay);
        const viewport = Viewport.create(page, capturedImage, viewportOpts);
        await viewport.handleImage(capturedImage);

        return this._extendScreenshot(viewport, page, cropImageOpts);
    }

    async _extendScreenshot(viewport, page, opts) {
        let shouldExtend = viewport.validate(this._browser);

        while (shouldExtend) {
            await this._extendImage(viewport, page, opts);

            shouldExtend = viewport.validate(this._browser);
        }

        return viewport.composite();
    }

    async _extendImage(viewport, page, opts) {
        const scrollHeight = Math.min(viewport.getVerticalOverflow(), page.viewport.height);

        await this._browser.scrollBy({ x: 0, y: scrollHeight, selector: opts.selectorToScroll });

        page.viewport.top += scrollHeight;

        const newImage = await this._browser.captureViewportImage(page, opts.screenshotDelay);

        await viewport.extendBy(scrollHeight, newImage);
    }
};
