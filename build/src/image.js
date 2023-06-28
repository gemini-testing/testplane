"use strict";
const Promise = require("bluebird");
const looksSame = require("looks-same");
const sharp = require("sharp");
module.exports = class Image {
    static create(buffer) {
        return new this(buffer);
    }
    constructor(buffer) {
        this._img = sharp(buffer);
        this._imageData = null;
        this._ignoreData = [];
        this._composeImages = [];
    }
    async getSize() {
        const imgSizes = await Promise.map([this].concat(this._composeImages), img => img._img.metadata());
        return imgSizes.reduce((totalSize, img) => {
            return {
                width: Math.max(totalSize.width, img.width),
                height: totalSize.height + img.height,
            };
        }, { width: 0, height: 0 });
    }
    async crop(rect) {
        const { height, width } = await this._img.metadata();
        this._img.extract({
            left: rect.left,
            top: rect.top,
            width: Math.min(width, rect.left + rect.width) - rect.left,
            height: Math.min(height, rect.top + rect.height) - rect.top,
        });
        await this._forceRefreshImageData();
    }
    addJoin(attachedImages) {
        this._composeImages = this._composeImages.concat(attachedImages);
    }
    async applyJoin() {
        if (!this._composeImages.length) {
            return;
        }
        const { height, width } = await this._img.metadata();
        const imagesData = await Promise.all(this._composeImages.map(img => img._getImageData()));
        const compositeData = [];
        let newHeight = height;
        for (const { data, info } of imagesData) {
            compositeData.push({
                input: data,
                left: 0,
                top: newHeight,
                raw: {
                    width: info.width,
                    height: info.height,
                    channels: info.channels,
                },
            });
            newHeight += info.height;
        }
        this._img.resize({
            width,
            height: newHeight,
            fit: "contain",
            position: "top",
        });
        this._img.composite(compositeData);
    }
    async addClear({ width, height, left, top }) {
        const { channels } = await this._img.metadata();
        this._ignoreData.push({
            input: {
                create: {
                    channels,
                    background: { r: 0, g: 0, b: 0, alpha: 1 },
                    width,
                    height,
                },
            },
            left,
            top,
        });
    }
    applyClear() {
        this._img.composite(this._ignoreData);
    }
    async _getImageData() {
        if (!this._imageData) {
            this._imageData = await this._img.raw().toBuffer({ resolveWithObject: true });
        }
        return this._imageData;
    }
    async _forceRefreshImageData() {
        this._imageData = await this._img.raw().toBuffer({ resolveWithObject: true });
        this._img = sharp(this._imageData.data, {
            raw: {
                width: this._imageData.info.width,
                height: this._imageData.info.height,
                channels: this._imageData.info.channels,
            },
        });
        this._composeImages = [];
        this._ignoreData = [];
    }
    async getRGBA(x, y) {
        const { data, info } = await this._getImageData();
        const idx = (info.width * y + x) * info.channels;
        return {
            r: data[idx],
            g: data[idx + 1],
            b: data[idx + 2],
            a: info.channels === 4 ? data[idx + 3] : 1,
        };
    }
    async save(file) {
        await this._img.png().toFile(file);
    }
    static fromBase64(base64) {
        return new this(Buffer.from(base64, "base64"));
    }
    async toPngBuffer(opts = { resolveWithObject: true }) {
        const imgData = await this._img.png().toBuffer(opts);
        return opts.resolveWithObject
            ? { data: imgData.data, size: { height: imgData.info.height, width: imgData.info.width } }
            : imgData;
    }
    static compare(path1, path2, opts = {}) {
        const compareOptions = {
            ignoreCaret: opts.canHaveCaret,
            pixelRatio: opts.pixelRatio,
            ...opts.compareOpts,
        };
        ["tolerance", "antialiasingTolerance"].forEach(option => {
            if (option in opts) {
                compareOptions[option] = opts[option];
            }
        });
        return looksSame(path1, path2, compareOptions);
    }
    static buildDiff(opts) {
        const { diffColor: highlightColor, ...otherOpts } = opts;
        const diffOptions = { highlightColor, ...otherOpts };
        return looksSame.createDiff(diffOptions);
    }
};
//# sourceMappingURL=image.js.map