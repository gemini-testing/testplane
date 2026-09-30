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
        if (reprepareScreenshot && page.isTopLevelViewport) {
            const currentPixelRatio = getPixelRatioFromImage(
                capturedImage,
                page,
                this._browser.config.screenshotMode === "auto",
            );

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

function getPixelRatioFromImage({ uncroppedSize: imageSize, isFullPage }, page, allowFallback = false) {
    const expectedSize = isFullPage ? { width: page.documentWidth, height: page.documentHeight } : page.viewport;
    const cssSize = isFullPage ? page.documentSizeInCss : page.viewportSizeInCss;

    // Allow rounding differences between CSS geometry and the captured bitmap.
    if (Math.abs(imageSize.width - expectedSize.width) <= 1 && Math.abs(imageSize.height - expectedSize.height) <= 1) {
        return;
    }

    // Each bitmap axis can round independently by one pixel.
    const minPixelRatio = Math.max((imageSize.width - 1) / cssSize.width, (imageSize.height - 1) / cssSize.height);
    const maxPixelRatio = Math.min((imageSize.width + 1) / cssSize.width, (imageSize.height + 1) / cssSize.height);
    if (minPixelRatio > maxPixelRatio) {
        // Auto detection uses the estimated DPR and can misidentify the source bitmap.
        if (allowFallback) {
            return getPixelRatioFromImage({ uncroppedSize: imageSize, isFullPage: !isFullPage }, page);
        }
        throw new Error("Screenshot dimensions do not match the viewport at a consistent pixel ratio");
    }

    const pixelRatio = (minPixelRatio + maxPixelRatio) / 2;
    const roundedPixelRatio = Math.round(pixelRatio);
    const epsilon = 0.001;

    return roundedPixelRatio > 0 &&
        pixelRatio >= roundedPixelRatio - epsilon &&
        pixelRatio <= roundedPixelRatio + epsilon
        ? roundedPixelRatio
        : pixelRatio;
}
