import makeDebug from "debug";
import { Image, Size, Point, Rect } from "../../../image";
import { NEW_ISSUE_LINK } from "../../../constants/help";

const debug = makeDebug("testplane:screenshots:composite-image");

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
    // Measured in global page coords
    private _captureArea: Rect;
    // Measured relative to viewport
    private _safeArea: Rect;
    // Measured in global page coords
    private _ignoreAreas: Rect[];
    // Ready to join image chunks along with their sizes
    private _compositeChunks: { image: Image, imageSize: Size }[];

    private _lastViewportImageBuffer: Buffer | null = null;
    private _lastContainerOffset: Point | null = null;
    private _lastViewportOffset: Point | null = null;

    static create(...args: ConstructorParameters<typeof CompositeImage>): CompositeImage {
        return new this(...args);
    }

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
            const ignoreAreaInImageCoords = getIntersection({
                width: area.width,
                height: area.height,
                left: area.left - this._captureArea.left,
                top: area.top - this._captureArea.top,
            }, {
                width: size.width,
                height: size.height,
                left: 0,
                top: 0,
            });

            if (ignoreAreaInImageCoords) {
                debug('Adding ignore area: %O', ignoreAreaInImageCoords);
                await image.addClear(ignoreAreaInImageCoords);
            }
        }
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

    async registerViewportImageAtOffset(viewportImage: Image, scrollElementOffset: Point, viewportOffset: Point): Promise<void> {
        const notCapturedArea = this.getNextNotCapturedArea() as Rect;
        const notCapturedAreaInViewportCoords = this._fromPageCoordsToViewportCoords(scrollElementOffset, viewportOffset, notCapturedArea);
        const cropAreaInViewportCoords = this._sanitize(getIntersection(this._safeArea, notCapturedAreaInViewportCoords));

        if (this._compositeChunks.length === 0 && cropAreaInViewportCoords.top > notCapturedAreaInViewportCoords.top) {
            debug('Safe area prevented us from capturing head of the element at the beginning, expanding crop area.');
            debug('  crop area top before: %O', cropAreaInViewportCoords.top);

            cropAreaInViewportCoords.height = cropAreaInViewportCoords.height + (cropAreaInViewportCoords.top - notCapturedAreaInViewportCoords.top);
            cropAreaInViewportCoords.top = Math.max(0, notCapturedAreaInViewportCoords.top);

            debug('  crop area top after: %O', cropAreaInViewportCoords.top);
        }

        this._lastViewportImageBuffer = await viewportImage.toPngBuffer({ resolveWithObject: false });
        this._lastContainerOffset = scrollElementOffset;
        this._lastViewportOffset = viewportOffset;

        debug('Captured the next chunk at offset %O.\n  notCapturedArea before capture: %O\n  notCapturedAreaInViewportCoords: %O\n  cropArea: %O\n  windowOffset: %O', scrollElementOffset, notCapturedArea, notCapturedAreaInViewportCoords, cropAreaInViewportCoords, viewportOffset);

        await viewportImage.crop(cropAreaInViewportCoords);

        this._compositeChunks.push({ image: viewportImage, imageSize: await viewportImage.getSize() });
    }

    async render(): Promise<Image> {
        if (!this._lastViewportImageBuffer || !this._lastContainerOffset || !this._lastViewportOffset) {
            throw new Error('Cannot render composite image: last viewport image buffer, container offset or window offset is not set.\n' +
                'This means that screenshot was not captured even once and we have no image to render.\n' + 
                'Please, make sure element that you are trying to capture exists and is valid.\n\n' +
                'If everything looks fine, but you are getting this error, please run your test with DEBUG=testplane:screenshots* and let us know at ' + NEW_ISSUE_LINK
            );
        }

        if (this.hasNotCapturedArea()) {
            debug('Safe area prevented us from capturing tail of the element in the end, adding it to the composite image.');

            const captureAreaTail = new Image(this._lastViewportImageBuffer);
            
            const notCapturedArea = this.getNextNotCapturedArea() as Rect;
            const notCapturedAreaInViewportCoords = this._fromPageCoordsToViewportCoords(this._lastContainerOffset, this._lastViewportOffset, notCapturedArea);
            const viewportSize = await captureAreaTail.getSize();
            const cropAreaInViewportCoords = this._sanitize(getIntersection({top: 0, left: 0, width: viewportSize.width, height: viewportSize.height}, notCapturedAreaInViewportCoords));

            if (cropAreaInViewportCoords.height > 0) {
                captureAreaTail.crop(cropAreaInViewportCoords);

                debug('  crop area coordinates: %O', cropAreaInViewportCoords);

                this._compositeChunks.push({ image: captureAreaTail, imageSize: await captureAreaTail.getSize() });
            } else {
                debug('  crop area is empty, skipping');
            }
        }

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

    private _fromPageCoordsToViewportCoords(scrollElementOffset: Point, viewportOffset: Point, areaInPageCoords: Rect): Rect {
        return {
            left: areaInPageCoords.left - scrollElementOffset.left - viewportOffset.left,
            top: areaInPageCoords.top - scrollElementOffset.top - viewportOffset.top,
            width: areaInPageCoords.width,
            height: areaInPageCoords.height,
        };
    }
}
