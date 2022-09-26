"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const coord_validator_1 = __importDefault(require("./coord-validator"));
class Viewport {
    constructor(viewport, _image, _pixelRatio, _opts) {
        this._image = _image;
        this._pixelRatio = _pixelRatio;
        this._opts = _opts;
        this._viewport = lodash_1.default.clone(viewport);
    }
    static create(viewport, image, pixelRatio, opts) {
        return new Viewport(viewport, image, pixelRatio, opts);
    }
    validate(captureArea, browser) {
        coord_validator_1.default.create(browser, this._opts).validate(this._viewport, captureArea);
    }
    ignoreAreas(areas) {
        (0, lodash_1.default)(areas)
            .map((area) => this._getIntersectionWithViewport(area))
            .compact()
            .forEach((area) => this._image.clear(this._transformToViewportOrigin(area), { scaleFactor: this._pixelRatio }));
    }
    crop(captureArea) {
        return this._image.crop(this._transformToViewportOrigin(captureArea), { scaleFactor: this._pixelRatio });
    }
    _getIntersectionWithViewport(area) {
        const top = Math.max(this._viewport.top, area.top);
        const bottom = Math.min(getAreaBottom(this._viewport), getAreaBottom(area));
        const left = Math.max(this._viewport.left, area.left);
        const right = Math.min(getAreaRight(this._viewport), getAreaRight(area));
        if (left >= right || top >= bottom) {
            return null;
        }
        return { top, left, width: right - left, height: bottom - top };
    }
    _transformToViewportOrigin(area) {
        return lodash_1.default.extend({}, area, {
            top: area.top - this._viewport.top,
            left: area.left - this._viewport.left
        });
    }
    save(path) {
        return this._image.save(path);
    }
    async extendBy(scrollHeight, newImage) {
        const newImageSize = newImage.getSize();
        const physicalScrollHeight = scrollHeight * this._pixelRatio;
        this._viewport.height += scrollHeight;
        const croppedImage = await newImage.crop({
            left: 0,
            top: newImageSize.height - physicalScrollHeight,
            width: newImageSize.width,
            height: physicalScrollHeight
        });
        return this._image.join(croppedImage);
    }
    getVerticalOverflow(captureArea) {
        return (captureArea.top + captureArea.height) - (this._viewport.top + this._viewport.height);
    }
}
exports.default = Viewport;
function getAreaBottom(area) {
    return area.top + area.height;
}
function getAreaRight(area) {
    return area.left + area.width;
}
