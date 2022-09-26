"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("debug"));
const height_viewport_error_1 = __importDefault(require("./errors/height-viewport-error"));
const offset_viewport_error_1 = __importDefault(require("./errors/offset-viewport-error"));
const isOutsideOfViewport = (viewport, cropArea) => cropArea.top < 0 || cropArea.left < 0 || cropArea.left + cropArea.width > viewport.width;
class CoordValidator {
    constructor(browser, _opts = {}) {
        this._opts = _opts;
        this._log = (0, debug_1.default)('gemini-core:coord-validator:' + browser.id);
    }
    static create(browser, opts) {
        return new CoordValidator(browser, opts);
    }
    /**
     * Validates compatibility of viewport and crop area coordinates
     */
    validate(viewport, cropArea) {
        this._log('viewport size', viewport);
        this._log('crop area', cropArea);
        if (this._opts.allowViewportOverflow && !this._opts.compositeImage) {
            return;
        }
        if (!this._opts.allowViewportOverflow && isOutsideOfViewport(viewport, cropArea)) {
            return this._reportOffsetViewportError();
        }
        if (cropArea.top + cropArea.height > viewport.top + viewport.height) {
            return this._reportHeightViewportError(viewport, cropArea);
        }
    }
    /**
     * Reports error if crop area is outside of viewport
     */
    _reportOffsetViewportError() {
        this._log('crop area is outside of the viewport left, top or right bounds');
        const message = `Can not capture the specified region of the viewport.
            Position of the region is outside of the viewport left, top or right bounds.
            Check that elements:
             - does not overflows the document
             - does not overflows browser viewport
            Alternatively, you can increase browser window size using
            "setWindowSize" or "windowSize" option in the config file.
            But if viewport overflow is expected behavior then you can use
            option "allowViewportOverflow" in "assertView" command.`;
        throw new offset_viewport_error_1.default(message);
    }
    /**
     * This case is handled specially because of Opera 12 browser.
     * Problem, described in error message occurs there much more often then
     * for other browsers and has different workaround
     */
    _reportHeightViewportError(viewport, cropArea) {
        this._log('crop area bottom bound is outside of the viewport height');
        const message = `Can not capture the specified region of the viewport.
            The region bottom bound is outside of the viewport height.
            Alternatively, you can test such cases by setting "true" value to option "compositeImage" in the config file
            or setting "false" to "compositeImage" and "true" to option "allowViewportOverflow" in "assertView" command.
            Element position: ${cropArea.left}, ${cropArea.top}; size: ${cropArea.width}, ${cropArea.height}.
            Viewport size: ${viewport.width}, ${viewport.height}.`;
        throw new height_viewport_error_1.default(message);
    }
}
exports.default = CoordValidator;
