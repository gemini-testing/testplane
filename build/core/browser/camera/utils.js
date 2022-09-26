"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFullPage = void 0;
const constants_1 = require("./constants");
function isFullPage(image, page, screenshotMode) {
    switch (screenshotMode) {
        case constants_1.ScreenshotMode.fullpage: return true;
        case constants_1.ScreenshotMode.viewport: return false;
        case constants_1.ScreenshotMode.auto: return compareDimensions(image, page);
    }
}
exports.isFullPage = isFullPage;
/**
 * @param image - PngImg wrapper
 * @param page - capture meta information object
 */
function compareDimensions(image, page) {
    const pixelRatio = page.pixelRatio;
    const documentWidth = page.documentWidth * pixelRatio;
    const documentHeight = page.documentHeight * pixelRatio;
    const imageSize = image.getSize();
    return imageSize.height >= documentHeight && imageSize.width >= documentWidth;
}
