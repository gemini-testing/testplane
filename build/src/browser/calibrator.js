"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Calibrator = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const looks_same_1 = __importDefault(require("looks-same"));
const core_error_1 = require("./core-error");
const DIRECTION = { FORWARD: "forward", REVERSE: "reverse" };
class Calibrator {
    constructor() {
        this._cache = {};
        this._script = fs_1.default.readFileSync(path_1.default.join(__dirname, "client-scripts", "calibrate.js"), "utf8");
    }
    async calibrate(browser) {
        if (this._cache[browser.id]) {
            return this._cache[browser.id];
        }
        await browser.open("about:blank");
        const features = await browser.evalScript(this._script);
        const image = await browser.captureViewportImage();
        const { innerWidth, pixelRatio } = features;
        const hasPixelRatio = Boolean(pixelRatio && pixelRatio > 1.0);
        const imageFeatures = await this._analyzeImage(image, { calculateColorLength: hasPixelRatio });
        if (!imageFeatures) {
            throw new core_error_1.CoreError("Could not calibrate. This could be due to calibration page has failed to open properly");
        }
        const calibratedFeatures = {
            ...features,
            top: imageFeatures.viewportStart.y,
            left: imageFeatures.viewportStart.x,
            usePixelRatio: hasPixelRatio && imageFeatures.colorLength > innerWidth,
        };
        this._cache[browser.id] = calibratedFeatures;
        return calibratedFeatures;
    }
    async _analyzeImage(image, params) {
        const imageHeight = (await image.getSize()).height;
        for (let y = 0; y < imageHeight; y++) {
            const result = await analyzeRow(y, image, params);
            if (result) {
                return result;
            }
        }
        return null;
    }
}
exports.Calibrator = Calibrator;
async function analyzeRow(row, image, params = {}) {
    const markerStart = await findMarkerInRow(row, image, DIRECTION.FORWARD);
    if (markerStart === -1) {
        return null;
    }
    const result = { viewportStart: { x: markerStart, y: row } };
    if (!params.calculateColorLength) {
        return result;
    }
    const markerEnd = await findMarkerInRow(row, image, DIRECTION.REVERSE);
    const colorLength = markerEnd - markerStart + 1;
    return { ...result, colorLength };
}
async function findMarkerInRow(row, image, searchDirection) {
    const imageWidth = (await image.getSize()).width;
    const searchColor = { R: 148, G: 250, B: 0 };
    if (searchDirection === DIRECTION.REVERSE) {
        return searchReverse_();
    }
    else {
        return searchForward_();
    }
    async function searchForward_() {
        for (let x = 0; x < imageWidth; x++) {
            if (await compare_(x)) {
                return x;
            }
        }
        return -1;
    }
    async function searchReverse_() {
        for (let x = imageWidth - 1; x >= 0; x--) {
            if (await compare_(x)) {
                return x;
            }
        }
        return -1;
    }
    async function compare_(x) {
        const pixel = await image.getRGBA(x, row);
        const color = pickRGB(pixel);
        return looks_same_1.default.colors(color, searchColor);
    }
}
function pickRGB(rgba) {
    return { R: rgba.r, G: rgba.g, B: rgba.b };
}
//# sourceMappingURL=calibrator.js.map