"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const viewport_1 = __importDefault(require("./viewport"));
const height_viewport_error_1 = __importDefault(require("./viewport/coord-validator/errors/height-viewport-error"));
class ScreenShooter {
    constructor(_browser) {
        this._browser = _browser;
    }
    static create(browser) {
        return new ScreenShooter(browser);
    }
    async capture(page, opts = {}) {
        const { allowViewportOverflow, compositeImage, screenshotDelay, selectorToScroll } = opts;
        const viewportOpts = { allowViewportOverflow, compositeImage };
        const cropImageOpts = { screenshotDelay, compositeImage, selectorToScroll };
        const viewportImage = await this._browser.captureViewportImage(page, screenshotDelay);
        const viewport = viewport_1.default.create(page.viewport, viewportImage, page.pixelRatio, viewportOpts);
        return this._cropImage(viewport, page, cropImageOpts);
    }
    async _cropImage(viewport, page, opts) {
        try {
            viewport.validate(page.captureArea, this._browser);
        }
        catch (e) {
            if (e instanceof height_viewport_error_1.default && opts.compositeImage) {
                return this._extendImage(viewport, page, opts);
            }
            throw e;
        }
        viewport.ignoreAreas(page.ignoreAreas);
        return viewport.crop(page.captureArea);
    }
    async _extendImage(viewport, page, opts) {
        const scrollHeight = Math.min(viewport.getVerticalOverflow(page.captureArea), page.viewport.height);
        await this._browser.scrollBy({ x: 0, y: scrollHeight, selector: opts.selectorToScroll });
        page.viewport.top += scrollHeight;
        const newImage = await this._browser.captureViewportImage(page, opts.screenshotDelay);
        await viewport.extendBy(scrollHeight, newImage);
        return this._cropImage(viewport, page, opts);
    }
}
exports.default = ScreenShooter;
