"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFullPage = void 0;
const isFullPage = (imageArea, page, screenshotMode) => {
    switch (screenshotMode) {
        case "fullpage":
            return true;
        case "viewport":
            return false;
        case "auto":
            return compareDimensions(imageArea, page);
    }
};
exports.isFullPage = isFullPage;
function compareDimensions(imageArea, page) {
    return imageArea.height >= page.documentHeight && imageArea.width >= page.documentWidth;
}
//# sourceMappingURL=utils.js.map