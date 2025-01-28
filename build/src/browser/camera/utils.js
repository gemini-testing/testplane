"use strict";
exports.isFullPage = (imageArea, page, screenshotMode) => {
    switch (screenshotMode) {
        case "fullpage":
            return true;
        case "viewport":
            return false;
        case "auto":
            return compareDimensions(imageArea, page);
    }
};
/**
 * @param {Object} imageArea - area
 * @param {number} imageArea.left - left offset
 * @param {number} imageArea.top - top offset
 * @param {number} imageArea.width - area width
 * @param {number} imageArea.height - area height
 * @param {Object} page - capture meta information object
 * @returns {boolean}
 * @private
 */
function compareDimensions(imageArea, page) {
    return imageArea.height >= page.documentHeight && imageArea.width >= page.documentWidth;
}
//# sourceMappingURL=utils.js.map