import debug from 'debug';

import HeightViewportError from './errors/height-viewport-error';
import OffsetViewportError from './errors/offset-viewport-error';

import type ExistingBrowser from '../../../../browser/existing-browser';
import type {SerializedRect} from '../../../types/rect';

const isOutsideOfViewport = (viewport: SerializedRect, cropArea: SerializedRect): boolean =>
    cropArea.top < 0 || cropArea.left < 0 || cropArea.left + cropArea.width > viewport.width;

type CoordValidatorOpts = {
    allowViewportOverflow?: boolean;
    compositeImage?: boolean;
};

export default class CoordValidator {
    private _log: debug.Debugger;

    static create(browser: ExistingBrowser, opts: CoordValidatorOpts): CoordValidator {
        return new CoordValidator(browser, opts);
    }

    constructor(browser: ExistingBrowser, private _opts: CoordValidatorOpts = {}) {
        this._log = debug('gemini-core:coord-validator:' + browser.id);
    }

    /**
     * Validates compatibility of viewport and crop area coordinates
     */
    validate(viewport: SerializedRect, cropArea: SerializedRect): void {
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
    private _reportOffsetViewportError(): never {
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

        throw new OffsetViewportError(message);
    }

    /**
     * This case is handled specially because of Opera 12 browser.
     * Problem, described in error message occurs there much more often then
     * for other browsers and has different workaround
     */
    private _reportHeightViewportError(viewport: SerializedRect, cropArea: SerializedRect): never {
        this._log('crop area bottom bound is outside of the viewport height');

        const message = `Can not capture the specified region of the viewport.
            The region bottom bound is outside of the viewport height.
            Alternatively, you can test such cases by setting "true" value to option "compositeImage" in the config file
            or setting "false" to "compositeImage" and "true" to option "allowViewportOverflow" in "assertView" command.
            Element position: ${cropArea.left}, ${cropArea.top}; size: ${cropArea.width}, ${cropArea.height}.
            Viewport size: ${viewport.width}, ${viewport.height}.`;

        throw new HeightViewportError(message);
    }
}
