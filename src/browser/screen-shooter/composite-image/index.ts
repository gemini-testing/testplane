import makeDebug from "debug";
// import _ from "lodash";
import { Image, Point, Rect } from "../../../image";
import { Size } from "@testplane/webdriverio/build/commands/element";

const debug = makeDebug("testplane:screenshots:composite-image");

// interface ViewportOpts {
//     allowViewportOverflow?: boolean;
//     compositeImage?: boolean;
// }

// interface ShiftParams {
//     left?: number;
//     top?: number;
// }

function getAreaBottom(area: Rect): number {
    return area.top + area.height;
}

function getAreaRight(area: Rect): number {
    return area.left + area.width;
}

function getIntersection(...areas: Rect[]): Rect | null {
    const top = Math.max(...areas.map(area => area.top));
    const bottom = Math.min(...areas.map(getAreaBottom));
    const left = Math.max(...areas.map(area => area.left));
    const right = Math.min(...areas.map(getAreaRight));

    if (left >= right || top >= bottom) {
        return null;
    }

    return { left, top, width: right - left, height: bottom - top };
}

export class CompositeImage {
    // Relative to global page
    private _captureArea: Rect;
    // Relative to viewport
    private _safeArea: Rect;
    // Relative to global page
    private _ignoreAreas: Rect[];
    // Relative to global page
    private _compositeChunks: { image: Image, imageSize: Size }[];
    // private _image: Image | null;
    // private _opts: ViewportOpts;
    // private _summaryHeight: number;
    // private _debugId?: string;

    static create(...args: ConstructorParameters<typeof CompositeImage>): CompositeImage {
        return new this(...args);
    }

    /**
     * @param captureArea - Element boundaries in global page coordinates. May overflow viewport
     * @param ignoreAreas - Boundaries of elements that we should ignore when comparing screenshots
     *                      in global page coordinates (these areas will be painted in black)
     */
    constructor(captureArea: Rect, safeArea: Rect, ignoreAreas: Rect[]) {
        this._captureArea = this._sanitize(captureArea);
        this._safeArea = this._sanitize(safeArea);
        this._ignoreAreas = ignoreAreas;
        this._compositeChunks = [];

        debug('CompositeImage initialized. captureArea: %O, safeArea: %O, ignoreAreas: %O', this._captureArea, this._safeArea, this._ignoreAreas);
    }

    private async _addIgnoreAreas(image: Image): Promise<void> {
        debug('Adding ignore areas to image.');
        const size = await image.getSize();

        debug('Image size: %O', size);

        for (const area of this._ignoreAreas) {
            debug('Adding ignore area: %O', {
                width: area.width,
                height: area.height,
                left: area.left - this._captureArea.left,
                top: area.top - this._captureArea.top,
            });
            await image.addClear({
                width: area.width,
                height: area.height,
                left: area.left - this._captureArea.left,
                top: area.top - this._captureArea.top,
            });
        }
        //     const imageClearArea = this._getIntersection(area, imageArea);

        //     debug(`[${this._debugId}] ignoreArea: %O`, area);
        //     debug(`[${this._debugId}] imageArea: %O`, imageArea);
        //     debug(`[${this._debugId}] resulting intersection, imageClearArea: %O`, imageClearArea);

        //     if (imageClearArea !== null) {
        //         await image.addClear(this._shiftArea(imageClearArea, { left: -imageArea.left, top: -imageArea.top }));
        //     }
        // }

        // image.applyClear();
    }

    hasNotCapturedArea(): boolean {
        return Boolean(this.getNextNotCapturedArea());
    }

    getNextNotCapturedArea(): Rect | null {
        const capturedAreaHeight = this._compositeChunks.reduce((acc, chunk) => acc + chunk.imageSize.height, 0);

        if (capturedAreaHeight >= this._captureArea.height) {
            return null;
        }

        return {
            left: this._captureArea.left,
            top: this._captureArea.top + capturedAreaHeight,
            width: this._captureArea.width,
            height: this._captureArea.height - capturedAreaHeight,
        }
    }

    /**
     * @param viewportImage - Image of the whole viewport
     * @param offset - Scroll offset at the time of capturing viewportImage.
     *                 Measured relative to the scroll element (or whole page, if selectorToScroll not specified)
     */
    async registerViewportImageAtOffset(viewportImage: Image, offset: Point, windowScrollY: number, windowScrollX: number): Promise<void> {
        // await this._applyIgnoreAreas(viewportImage, offset);

        const notCapturedArea = this.getNextNotCapturedArea() as Rect;
        const notCapturedAreaInViewportCoords = this._fromPageCoordsToViewportCoords(offset, windowScrollY, windowScrollX, notCapturedArea);
        const cropAreaInViewportCoords = this._sanitize(getIntersection(this._safeArea, notCapturedAreaInViewportCoords));

        debug('Captured the next chunk at offset %O.\n  notCapturedArea before capture: %O\n  notCapturedAreaInViewportCoords: %O\n  cropArea: %O\n  windowScrollY: %d\n  windowScrollX: %d', offset, notCapturedArea, notCapturedAreaInViewportCoords, cropAreaInViewportCoords, windowScrollY, windowScrollX);
        await viewportImage.crop(cropAreaInViewportCoords);

        this._compositeChunks.push({ image: viewportImage, imageSize: await viewportImage.getSize() });

    }

    async render(): Promise<Image> {
        debug('Rendering composite image.');

        const image = new Image(await this._compositeChunks[0].image.toPngBuffer({ resolveWithObject: false }));

        if (this._compositeChunks.length > 1) {
            image.addJoin(this._compositeChunks.slice(1).map(chunk => {
                debug('  Adding chunk to join. imageSize: %O', chunk.imageSize);

                return chunk.image;
            }));
        }

        await this._addIgnoreAreas(image);

        await image.applyJoin();

        return image;
    }

    // async save(path: string): Promise<void> {
    //     return this._image.save(path);
    // }

    // private async _extendBy(physicalScrollHeight: number, newImage: Image): Promise<void> {
    //     this._viewport.height += physicalScrollHeight;
    //     const { width, height } = await newImage.getSize();

    //     await this.handleImage(newImage, {
    //         left: 0,
    //         top: height - physicalScrollHeight,
    //         width,
    //         height: physicalScrollHeight,
    //     });

    //     this._image.addJoin([newImage]);
    // }

    // getVerticalOverflow(): number {
    //     return getAreaBottom(this._captureArea) - getAreaBottom(this._viewport);
    // }

    private _sanitize(area: Rect | null): Rect {
        if (!area) {
            return { left: 0, top: 0, width: 0, height: 0 };
        }

        return {
            left: Math.max(area.left, 0),
            top: Math.max(area.top, 0),
            width: Math.max(area.width, 0),
            height: Math.max(area.height, 0),
        };
    }

    // private _shiftArea(area: Rect, { left, top }: ShiftParams = {}): Rect {
    //     const shiftLeft = left || 0;
    //     const shiftTop = top || 0;

    //     return {
    //         left: area.left + shiftLeft,
    //         top: area.top + shiftTop,
    //         width: area.width,
    //         height: area.height,
    //     };
    // }

    // private _transformToCaptureArea(area: Rect): Rect {
    //     const shiftX = area.left - this._viewport.left;
    //     const shiftY = area.top - this._viewport.top;
    //     const shiftedImageArea = this._shiftArea(area, { top: this._summaryHeight });
    //     const shiftedCaptureArea = this._sanitize(this._shiftArea(this._captureArea, { left: shiftX, top: shiftY }));
    //     const intersectingArea = this._getIntersection(shiftedImageArea, shiftedCaptureArea) || shiftedImageArea;

    //     return this._shiftArea(intersectingArea, { left: this._viewport.left, top: this._viewport.top });
    // }

    private _fromPageCoordsToViewportCoords(viewportOffsetInPageCoords: Point, windowScrollY: number, windowScrollX: number, areaInPageCoords: Rect): Rect {
        return {
            left: areaInPageCoords.left - viewportOffsetInPageCoords.left - windowScrollX,
            top: areaInPageCoords.top - viewportOffsetInPageCoords.top - windowScrollY,
            width: areaInPageCoords.width,
            height: areaInPageCoords.height,
        };
    }
}
