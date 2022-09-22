import fs from 'fs';
import _ from 'lodash';
import looksSame from 'looks-same';
import path from 'path';

import type {Color} from 'png-img/dist/types';

import {CoreError} from '../errors';

import type Image from '../image';
import type ExistingBrowser from '../../browser/existing-browser';
import type {CalibrationResult, Features} from '../types/calibrator';

const clientScriptCalibrate = fs.readFileSync(path.join(__dirname, '..', 'browser', 'client-scripts', 'calibrate.min.js'), 'utf8');

enum DIRECTION {
    FORWARD = 'forward',
    REVERSE = 'reverse'
}

type AnalyzeImageParams = {
    calculateColorLength?: boolean;
};

type AnalyzeRowResult = {
    viewportStart: {
        x: number;
        y: number;
    };
    colorLength?: number;
};

export default class Calibrator {
    private _cache: Record<string, CalibrationResult> = {};

    async calibrate(browser: ExistingBrowser): Promise<CalibrationResult> {
        if (this._cache[browser.id]) {
            return this._cache[browser.id];
        }

        await browser.open('about:blank');

        const features: Features = await browser.evalScript(clientScriptCalibrate);
        const image = await browser.captureViewportImage();

        const {innerWidth, pixelRatio} = features;
        const hasPixelRatio = Boolean(pixelRatio && pixelRatio > 1.0);
        const imageFeatures = this._analyzeImage(image, {calculateColorLength: hasPixelRatio});

        if (!imageFeatures) {
            throw new CoreError(
                'Could not calibrate. This could be due to calibration page has failed to open properly'
            );
        }

        const calibrationResult = _.extend(features, {
            top: imageFeatures.viewportStart.y,
            left: imageFeatures.viewportStart.x,
            usePixelRatio: hasPixelRatio && (imageFeatures.colorLength || 0) > innerWidth
        });

        this._cache[browser.id] = calibrationResult;

        return calibrationResult;
    }

    private _analyzeImage(image: Image, params: AnalyzeImageParams): AnalyzeRowResult | null {
        const imageHeight = image.getSize().height;

        for (let y = 0; y < imageHeight; y++) {
            const result = analyzeRow(y, image, params);

            if (result) {
                return result;
            }
        }

        return null;
    }
}

function analyzeRow(row: number, image: Image, params: AnalyzeImageParams = {}): AnalyzeRowResult | null {
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

function findMarkerInRow(row: number, image: Image, searchDirection: DIRECTION): number {
    const imageWidth = image.getSize().width;
    const searchColor = {R: 148, G: 250, B: 0};

    if (searchDirection === DIRECTION.REVERSE) {
        return searchReverse_();
    } else {
        return searchForward_();
    }

    function searchForward_(): number {
        for (let x = 0; x < imageWidth; x++) {
            if (compare_(x)) {
                return x;
            }
        }

        return -1;
    }

    function searchReverse_(): number {
        for (let x = imageWidth - 1; x >= 0; x--) {
            if (compare_(x)) {
                return x;
            }
        }

        return -1;
    }

    function compare_(x: number): boolean {
        const color = pickRGB(image.getRGBA(x, row));

        return looksSame.colors(color, searchColor);
    }
}

function pickRGB(rgba: Color): looksSame.Color {
    return {
        R: rgba.r,
        G: rgba.g,
        B: rgba.b
    };
}
