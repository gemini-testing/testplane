'use strict';

const Promise = require('bluebird');
const looksSame = require('looks-same');
const {PngImg} = require('png-img');
const utils = require('png-img/utils');
const SafeRect = require('./safe-rect');

module.exports = class Image {
    static create(buffer) {
        return new this(buffer);
    }

    constructor(buffer) {
        this._img = new PngImg(buffer);
    }

    crop(rect, opts = {}) {
        rect = this._scale(rect, (opts).scaleFactor);
        const imageSize = this.getSize();
        const safeRect = SafeRect.create(rect, imageSize);

        this._img.crop(
            safeRect.left,
            safeRect.top,
            safeRect.width,
            safeRect.height
        );

        return Promise.resolve(this);
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
        area = this._scale(area, (opts).scaleFactor);
        this._img.fill(
            area.left,
            area.top,
            area.width,
            area.height,
            '#000000'
        );
    }

    join(newImage) {
        const imageSize = this.getSize();
        this._img
            .setSize(imageSize.width, imageSize.height + newImage.getSize().height)
            .insert(newImage._img, 0, imageSize.height);

        return this;
    }

    _scale(area, scaleFactor) {
        scaleFactor = scaleFactor || 1;

        return {
            left: area.left * scaleFactor,
            top: area.top * scaleFactor,
            width: area.width * scaleFactor,
            height: area.height * scaleFactor
        };
    }

    static fromBase64(base64) {
        return new Image(new Buffer(base64, 'base64'));
    }

    static RGBToString(rgb) {
        return utils.RGBToString(rgb);
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

        return looksSame(path1, path2, compareOptions);
    }

    static buildDiff(opts) {
        const {diffColor: highlightColor, ...otherOpts} = opts;
        const diffOptions = {highlightColor, ...otherOpts};

        return looksSame.createDiff(diffOptions);
    }
};
