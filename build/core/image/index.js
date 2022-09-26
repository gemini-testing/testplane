"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bluebird_1 = __importDefault(require("bluebird"));
const looks_same_1 = __importDefault(require("looks-same"));
const png_img_1 = require("png-img");
// @ts-expect-error
const utils_1 = __importDefault(require("png-img/utils"));
const safe_rect_1 = __importDefault(require("./safe-rect"));
class Image {
    constructor(buffer) {
        this._img = new png_img_1.PngImg(buffer);
    }
    static create(buffer) {
        return new this(buffer);
    }
    crop(rect, opts = {}) {
        rect = this._scale(rect, opts.scaleFactor);
        const imageSize = this.getSize();
        const safeRect = safe_rect_1.default.create(rect, imageSize);
        this._img.crop(safeRect.left, safeRect.top, safeRect.width, safeRect.height);
        return bluebird_1.default.resolve(this);
    }
    getSize() {
        return this._img.size();
    }
    getRGBA(x, y) {
        return this._img.get(x, y);
    }
    save(file) {
        return this._img.save(file);
    }
    clear(area, opts = {}) {
        area = this._scale(area, opts.scaleFactor);
        this._img.fill(area.left, area.top, area.width, area.height, '#000000');
    }
    join(newImage) {
        const imageSize = this.getSize();
        this._img
            .setSize(imageSize.width, imageSize.height + newImage.getSize().height)
            .insert(newImage._img, 0, imageSize.height);
        return this;
    }
    _scale(area, scaleFactor = 1) {
        return {
            left: area.left * scaleFactor,
            top: area.top * scaleFactor,
            width: area.width * scaleFactor,
            height: area.height * scaleFactor
        };
    }
    static fromBase64(base64) {
        return new Image(Buffer.from(base64, 'base64'));
    }
    static RGBToString(rgb) {
        return utils_1.default.RGBToString(rgb);
    }
    static compare(path1, path2, opts = {}) {
        const compareOptions = {
            ignoreCaret: opts.canHaveCaret,
            pixelRatio: opts.pixelRatio,
            ...opts.compareOpts
        };
        ['tolerance', 'antialiasingTolerance'].forEach((option) => {
            if (option in opts) {
                compareOptions[option] = opts[option];
            }
        });
        return (0, looks_same_1.default)(path1, path2, compareOptions);
    }
    static buildDiff(opts) {
        const { diffColor: highlightColor, ...otherOpts } = opts;
        const diffOptions = { highlightColor, ...otherOpts };
        return looks_same_1.default.createDiff(diffOptions);
    }
}
exports.default = Image;
