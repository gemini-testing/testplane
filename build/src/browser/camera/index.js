"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Camera = void 0;
const lodash_1 = __importDefault(require("lodash"));
const image_1 = require("../../image");
const utils = __importStar(require("./utils"));
class Camera {
    static create(screenshotMode, takeScreenshot) {
        return new this(screenshotMode, takeScreenshot);
    }
    constructor(screenshotMode, takeScreenshot) {
        this._screenshotMode = screenshotMode;
        this._takeScreenshot = takeScreenshot;
        this._calibration = null;
    }
    calibrate(calibration) {
        this._calibration = calibration;
    }
    async captureViewportImage(page) {
        const base64 = await this._takeScreenshot();
        const image = image_1.Image.fromBase64(base64);
        const { width, height } = await image.getSize();
        const imageArea = { left: 0, top: 0, width, height };
        const calibratedArea = this._calibrateArea(imageArea);
        const viewportCroppedArea = this._cropAreaToViewport(calibratedArea, page);
        if (viewportCroppedArea.width !== width || viewportCroppedArea.height !== height) {
            await image.crop(viewportCroppedArea);
        }
        return image;
    }
    _calibrateArea(imageArea) {
        if (!this._calibration) {
            return imageArea;
        }
        const { left, top } = this._calibration;
        return { left, top, width: imageArea.width - left, height: imageArea.height - top };
    }
    _cropAreaToViewport(imageArea, page) {
        if (!page) {
            return imageArea;
        }
        const isFullPage = utils.isFullPage(imageArea, page, this._screenshotMode);
        const cropArea = lodash_1.default.clone(page.viewport);
        if (!isFullPage) {
            lodash_1.default.extend(cropArea, { top: 0, left: 0 });
        }
        return {
            left: imageArea.left + cropArea.left,
            top: imageArea.top + cropArea.top,
            width: Math.min(imageArea.width - cropArea.left, cropArea.width),
            height: Math.min(imageArea.height - cropArea.top, cropArea.height),
        };
    }
}
exports.Camera = Camera;
//# sourceMappingURL=index.js.map