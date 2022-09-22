import _ from 'lodash';

import CoordValidator from './coord-validator';

import type Image from '../../image';
import type ExistingBrowser from '../../../browser/existing-browser';
import type {SerializedRect} from '../../types/rect';

type ViewportOpts = {
    allowViewportOverflow?: boolean;
    compositeImage?: boolean;
};

export default class Viewport {
    private _viewport: SerializedRect;

    static create(viewport: SerializedRect, image: Image, pixelRatio: number, opts: ViewportOpts): Viewport {
        return new Viewport(viewport, image, pixelRatio, opts);
    }

    constructor(viewport: SerializedRect, private _image: Image, private _pixelRatio: number, private _opts: ViewportOpts) {
        this._viewport = _.clone(viewport);
    }

    validate(captureArea: SerializedRect, browser: ExistingBrowser): void {
        CoordValidator.create(browser, this._opts).validate(this._viewport, captureArea);
    }

    ignoreAreas(areas: Array<SerializedRect>): void {
        _(areas)
            .map((area) => this._getIntersectionWithViewport(area))
            .compact()
            .forEach((area) => this._image.clear(this._transformToViewportOrigin(area), {scaleFactor: this._pixelRatio}));
    }

    crop(captureArea: SerializedRect): Promise<Image> {
        return this._image.crop(this._transformToViewportOrigin(captureArea), {scaleFactor: this._pixelRatio});
    }

    private _getIntersectionWithViewport(area: SerializedRect): SerializedRect | null {
        const top = Math.max(this._viewport.top, area.top);
        const bottom = Math.min(getAreaBottom(this._viewport), getAreaBottom(area));
        const left = Math.max(this._viewport.left, area.left);
        const right = Math.min(getAreaRight(this._viewport), getAreaRight(area));

        if (left >= right || top >= bottom) {
            return null;
        }

        return {top, left, width: right - left, height: bottom - top};
    }

    private _transformToViewportOrigin(area: SerializedRect): SerializedRect {
        return _.extend({}, area, {
            top: area.top - this._viewport.top,
            left: area.left - this._viewport.left
        });
    }

    save(path: string): Promise<void> {
        return this._image.save(path);
    }

    async extendBy(scrollHeight: number, newImage: Image): Promise<Image> {
        const newImageSize = newImage.getSize();
        const physicalScrollHeight = scrollHeight * this._pixelRatio;

        this._viewport.height += scrollHeight;

        const croppedImage = await newImage.crop({
            left: 0,
            top: newImageSize.height - physicalScrollHeight,
            width: newImageSize.width,
            height: physicalScrollHeight
        });

        return this._image.join(croppedImage);
    }

    getVerticalOverflow(captureArea: SerializedRect): number {
        return (captureArea.top + captureArea.height) - (this._viewport.top + this._viewport.height);
    }
}

function getAreaBottom(area: SerializedRect): number {
    return area.top + area.height;
}

function getAreaRight(area: SerializedRect): number {
    return area.left + area.width;
}
