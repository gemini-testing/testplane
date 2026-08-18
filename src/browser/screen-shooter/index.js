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
        const { allowViewportOverflow, compositeImage, screenshotDelay, selectorToScroll, preferredPixelRatio } = opts;
        const viewportOpts = { allowViewportOverflow, compositeImage };
        const cropImageOpts = { screenshotDelay, compositeImage, selectorToScroll };

        const capturedImage = await this._browser.captureViewportImage(page, screenshotDelay);
        if (preferredPixelRatio) {
            const currentPixelRatio = await this._browser.evalScript("window.devicePixelRatio");

            if (currentPixelRatio !== preferredPixelRatio) {
                const scale = currentPixelRatio / page.pixelRatio;
                const scaleArea = area => {
                    area.left *= scale;
                    area.top *= scale;
                    area.width *= scale;
                    area.height *= scale;
                };

                [page.captureArea, page.viewport, ...page.ignoreAreas].forEach(scaleArea);
                page.documentHeight *= scale;
                page.documentWidth *= scale;
                page.pixelRatio = currentPixelRatio;
                delete opts.preferredPixelRatio;

                return this.capture(page, opts);
            }
        }

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
        const physicalScrollHeight = Math.min(viewport.getVerticalOverflow(), page.viewport.height);
        const logicalScrollHeight = Math.ceil(physicalScrollHeight / page.pixelRatio);

        await this._browser.scrollBy({ x: 0, y: logicalScrollHeight, selector: opts.selectorToScroll });

        page.viewport.top += physicalScrollHeight;

        const newImage = await this._browser.captureViewportImage(page, opts.screenshotDelay);

        await viewport.extendBy(physicalScrollHeight, newImage);
    }
};
