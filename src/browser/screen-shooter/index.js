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
        const { allowViewportOverflow, compositeImage, screenshotDelay, selectorToScroll, reprepareScreenshot } = opts;
        const viewportOpts = { allowViewportOverflow, compositeImage };
        const cropImageOpts = { screenshotDelay, compositeImage, selectorToScroll };

        const capturedImage = await this._browser.captureViewportImage(page, screenshotDelay);
        if (reprepareScreenshot) {
            const currentPixelRatio = getPixelRatioFromImage(capturedImage.uncroppedSize, page);

            if (currentPixelRatio !== undefined) {
                Object.assign(page, await reprepareScreenshot(currentPixelRatio));
                delete opts.preferredPixelRatio;
                delete opts.reprepareScreenshot;

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

function getPixelRatioFromImage(imageSize, page) {
    // Allow rounding differences between CSS geometry and the captured bitmap.
    if (
        Math.abs(imageSize.width - page.viewport.width) <= 1 &&
        Math.abs(imageSize.height - page.viewport.height) <= 1
    ) {
        return;
    }

    const pixelRatio = imageSize.width / page.viewportSizeInCss.width;
    if (Math.abs(imageSize.height - page.viewportSizeInCss.height * pixelRatio) > 1) {
        throw new Error("Screenshot dimensions do not match the viewport at a consistent pixel ratio");
    }

    const roundedPixelRatio = Math.round(pixelRatio);
    const epsilon = 0.001;

    return roundedPixelRatio > 0 &&
        pixelRatio >= roundedPixelRatio - epsilon &&
        pixelRatio <= roundedPixelRatio + epsilon
        ? roundedPixelRatio
        : pixelRatio;
}
