import _ from "lodash";
import { CoordValidator } from "./coord-validator";
import { Image, Rect } from "../../../image";
import { PrepareScreenshotResult } from "../types";
import { ExistingBrowser } from "../../existing-browser";

interface ViewportOpts {
    allowViewportOverflow?: boolean;
    compositeImage?: boolean;
}

interface ShiftParams {
    left?: number;
    top?: number;
}

function getAreaBottom(area: Rect): number {
    return area.top + area.height;
}

function getAreaRight(area: Rect): number {
    return area.left + area.width;
}

export class Viewport {
    private _viewport: Rect;
    private _captureArea: Rect;
    private _ignoreAreas: Rect[];
    private _image: Image;
    private _opts: ViewportOpts;
    private _summaryHeight: number;

    static create(...args: ConstructorParameters<typeof Viewport>): Viewport {
        return new this(...args);
    }

    constructor(page: PrepareScreenshotResult, image: Image, opts: ViewportOpts) {
        this._viewport = _.clone(page.viewport);
        this._captureArea = this._sanitize(page.captureArea);
        this._ignoreAreas = page.ignoreAreas;
        this._image = image;
        this._opts = opts;
        this._summaryHeight = 0;
    }

    validate(browser: ExistingBrowser): void {
        const coordValidator = CoordValidator.create(browser, this._opts);

        return coordValidator.validate(this._viewport, this._captureArea);
    }

    async ignoreAreas(image: Image, imageArea: Rect): Promise<void> {
        for (const area of this._ignoreAreas) {
            const imageClearArea = this._getIntersection(area, imageArea);

            if (imageClearArea !== null) {
                await image.addClear(this._shiftArea(imageClearArea, { left: -imageArea.left, top: -imageArea.top }));
            }
        }

        image.applyClear();
    }

    async handleImage(image: Image, area: Partial<Rect> = {}): Promise<void> {
        const { width, height } = await image.getSize();
        _.defaults(area, { left: 0, top: 0, width, height });
        const capturedArea = this._transformToCaptureArea(area as Rect);

        await this.ignoreAreas(image, this._shiftArea(capturedArea, { left: -area.left!, top: -area.top! }));
        await image.crop(this._sanitize(this._transformToViewportOrigin(capturedArea)));

        this._summaryHeight += capturedArea.height;
    }

    async composite(): Promise<Image> {
        await this._image.applyJoin();

        return this._image;
    }

    async save(path: string): Promise<void> {
        return this._image.save(path);
    }

    async extendBy(physicalScrollHeight: number, newImage: Image): Promise<void> {
        this._viewport.height += physicalScrollHeight;
        const { width, height } = await newImage.getSize();

        await this.handleImage(newImage, {
            left: 0,
            top: height - physicalScrollHeight,
            width,
            height: physicalScrollHeight,
        });

        this._image.addJoin([newImage]);
    }

    getVerticalOverflow(): number {
        return getAreaBottom(this._captureArea) - getAreaBottom(this._viewport);
    }

    private _sanitize(area: Rect): Rect {
        return {
            left: Math.max(area.left, 0),
            top: Math.max(area.top, 0),
            width: Math.max(area.width, 0),
            height: Math.max(area.height, 0),
        };
    }

    private _getIntersection(...areas: Rect[]): Rect | null {
        const top = Math.max(...areas.map(area => area.top));
        const bottom = Math.min(...areas.map(getAreaBottom));
        const left = Math.max(...areas.map(area => area.left));
        const right = Math.min(...areas.map(getAreaRight));

        if (left >= right || top >= bottom) {
            return null;
        }

        return { left, top, width: right - left, height: bottom - top };
    }

    private _shiftArea(area: Rect, { left, top }: ShiftParams = {}): Rect {
        const shiftLeft = left || 0;
        const shiftTop = top || 0;

        return {
            left: area.left + shiftLeft,
            top: area.top + shiftTop,
            width: area.width,
            height: area.height,
        };
    }

    private _transformToCaptureArea(area: Rect): Rect {
        const shiftX = area.left - this._viewport.left;
        const shiftY = area.top - this._viewport.top;
        const shiftedImageArea = this._shiftArea(area, { top: this._summaryHeight });
        const shiftedCaptureArea = this._sanitize(this._shiftArea(this._captureArea, { left: shiftX, top: shiftY }));
        const intersectingArea = this._getIntersection(shiftedImageArea, shiftedCaptureArea) || shiftedImageArea;

        return this._shiftArea(intersectingArea, { left: this._viewport.left, top: this._viewport.top });
    }

    private _transformToViewportOrigin(area: Rect): Rect {
        return this._shiftArea(area, { left: -this._viewport.left, top: -this._viewport.top - this._summaryHeight });
    }
}
