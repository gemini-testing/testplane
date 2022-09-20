'use strict';

const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const _ = require('lodash');
const looksSame = require('looks-same');
const {CoreError} = require('../errors');

const clientScriptCalibrate = fs.readFileSync(path.join(__dirname, '..', 'browser', 'client-scripts', 'calibrate.min.js'), 'utf8');
const DIRECTION = {FORWARD: 'forward', REVERSE: 'reverse'};

module.exports = class Calibrator {
    constructor() {
        this._cache = {};
    }

    /**
     * @param {Browser} browser
     * @returns {Promise.<CalibrationResult>}
     */
    calibrate(browser) {
        if (this._cache[browser.id]) {
            return Promise.resolve(this._cache[browser.id]);
        }

        return Promise.resolve(browser.open('about:blank'))
            .then(() => browser.evalScript(clientScriptCalibrate))
            .then((features) => [features, browser.captureViewportImage()])
            .spread((features, image) => {
                const {innerWidth, pixelRatio} = features;
                const hasPixelRatio = Boolean(pixelRatio && pixelRatio > 1.0);
                const imageFeatures = this._analyzeImage(image, {calculateColorLength: hasPixelRatio});

                if (!imageFeatures) {
                    return Promise.reject(new CoreError(
                        'Could not calibrate. This could be due to calibration page has failed to open properly'
                    ));
                }

                features = _.extend(features, {
                    top: imageFeatures.viewportStart.y,
                    left: imageFeatures.viewportStart.x,
                    usePixelRatio: hasPixelRatio && imageFeatures.colorLength > innerWidth
                });

                this._cache[browser.id] = features;

                return features;
            });
    }

    _analyzeImage(image, params) {
        const imageHeight = image.getSize().height;

        for (var y = 0; y < imageHeight; y++) {
            var result = analyzeRow(y, image, params);

            if (result) {
                return result;
            }
        }

        return null;
    }
};

function analyzeRow(row, image, params = {}) {
    const markerStart = findMarkerInRow(row, image, DIRECTION.FORWARD);

    if (markerStart === -1) {
        return null;
    }

    const result = {viewportStart: {x: markerStart, y: row}};

    if (!params.calculateColorLength) {
        return result;
    }

    const markerEnd = findMarkerInRow(row, image, DIRECTION.REVERSE);
    const colorLength = markerEnd - markerStart + 1;

    return _.extend(result, {colorLength});
}

function findMarkerInRow(row, image, searchDirection) {
    const imageWidth = image.getSize().width;
    const searchColor = {R: 148, G: 250, B: 0};

    if (searchDirection === DIRECTION.REVERSE) {
        return searchReverse_();
    } else {
        return searchForward_();
    }

    function searchForward_() {
        for (var x = 0; x < imageWidth; x++) {
            if (compare_(x)) {
                return x;
            }
        }
        return -1;
    }

    function searchReverse_() {
        for (var x = imageWidth - 1; x >= 0; x--) {
            if (compare_(x)) {
                return x;
            }
        }
        return -1;
    }

    function compare_(x) {
        var color = pickRGB(image.getRGBA(x, row));
        return looksSame.colors(color, searchColor);
    }
}

function pickRGB(rgba) {
    return {
        R: rgba.r,
        G: rgba.g,
        B: rgba.b
    };
}
