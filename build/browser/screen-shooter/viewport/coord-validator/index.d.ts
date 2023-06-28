export = CoordValidator;
declare class CoordValidator {
    static create(...args: any[]): import(".");
    /**
     * @param {Browser} browser session instance
     * @param {Object} opts
     * @param {Boolean} [opts.allowViewportOverflow] ignore OffsetViewportError
     * @param {Boolean} [opts.compositeImage] allow area bottom bound to be outside of viewport
     */
    constructor(browser: Browser, opts?: {
        allowViewportOverflow?: boolean | undefined;
        compositeImage?: boolean | undefined;
    });
    _log: any;
    _opts: {
        allowViewportOverflow?: boolean | undefined;
        compositeImage?: boolean | undefined;
    };
    /**
     * Validates compatibility of viewport and crop area coordinates
     * @param {Object} viewport
     * @param {Object} cropArea
     */
    validate(viewport: Object, cropArea: Object): true | HeightViewportError | OffsetViewportError | undefined;
    /**
     * Reports error if crop area is outside of viewport
     * @returns {OffsetViewportError}
     * @private
     */
    private _reportOffsetViewportError;
    /**
     * This case is handled specially because of Opera 12 browser.
     * Problem, described in error message occurs there much more often then
     * for other browsers and has different workaround
     * @param {Object} viewport
     * @param {Object} cropArea - crop area
     * @returns {HeightViewportError}
     * @private
     */
    private _reportHeightViewportError;
}
import HeightViewportError = require("./errors/height-viewport-error");
import OffsetViewportError = require("./errors/offset-viewport-error");
