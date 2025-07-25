import sharp from "sharp";
import looksSame from "looks-same";
import { DiffOptions, ImageSize } from "./types";
import makeDebug from "debug";

const debug = makeDebug("testplane:screenshots:image");

interface SharpImageData {
    data: Buffer;
    info: sharp.OutputInfo;
}

interface PngImageData {
    data: Buffer;
    size: ImageSize;
}

export interface Point {
    top: number;
    left: number;
}

export interface Size {
    width: number;
    height: number;
}

export type Rect = Point & Size;

export interface RGBA {
    r: number;
    g: number;
    b: number;
    a: number;
}

interface CompareOptions {
    canHaveCaret?: boolean;
    pixelRatio?: number;
    compareOpts?: looksSame.LooksSameOptions;
    tolerance?: number;
    antialiasingTolerance?: number;
}

export class Image {
    private _img: sharp.Sharp;
    private _imageData: SharpImageData | null = null;
    private _ignoreData: sharp.OverlayOptions[] = [];
    // eslint-disable-next-line no-use-before-define
    private _composeImages: Image[] = [];

    static create(buffer: Buffer): Image {
        return new this(buffer);
    }

    constructor(buffer: Buffer) {
        this._img = sharp(buffer);
    }

    async getSize(): Promise<ImageSize> {
        const imgSizes = await Promise.all([this, ...this._composeImages].map(img => img._img.metadata()));

        return imgSizes.reduce(
            (totalSize, img) => {
                return {
                    width: Math.max(totalSize.width, img.width!),
                    height: totalSize.height + img.height!,
                };
            },
            { width: 0, height: 0 },
        );
    }

    async crop(rect: Rect): Promise<void> {
        const { height, width } = await this._img.metadata();

        this._img.extract({
            left: rect.left,
            top: rect.top,
            width: Math.min(width!, rect.left + rect.width) - rect.left,
            height: Math.min(height!, rect.top + rect.height) - rect.top,
        });

        await this._forceRefreshImageData();
    }

    addJoin(attachedImages: Image[]): void {
        this._composeImages = this._composeImages.concat(attachedImages);
    }

    async applyJoin(): Promise<void> {
        debug('Applying join. composeImages length: %d, ignoreData length: %d', this._composeImages.length, this._ignoreData.length);
        if (!this._composeImages.length && !this._ignoreData.length) return;

        const { height, width } = await this._img.metadata();
        const imagesData = await Promise.all(this._composeImages.map(img => img._getImageData()));
        const compositeData = [];

        let newHeight = height!;

        for (const { data, info } of imagesData) {
            compositeData.push({
                input: data,
                left: 0,
                top: newHeight,
                raw: {
                    width: info.width,
                    height: info.height,
                    channels: info.channels,
                },
            });

            newHeight += info.height;
        }

        this._img.resize({
            width,
            height: newHeight,
            fit: "contain",
            position: "top",
        });

        debug('Performing applyJoin. image size: %O, compositeData: %O', { width, height: newHeight }, compositeData);

        compositeData.push(...this._ignoreData);

        this._img.composite(compositeData);
    }

    async addClear({ width, height, left, top }: Rect): Promise<void> {
        const { channels } = await this._img.metadata();

        this._ignoreData.push({
            input: {
                create: {
                    channels: channels!,
                    background: { r: 0, g: 0, b: 0, alpha: 1 },
                    width,
                    height,
                },
            },
            left,
            top,
        });
    }

    applyClear(): void {
        this._img.composite(this._ignoreData);
    }

    private async _getImageData(): Promise<SharpImageData> {
        if (!this._imageData) {
            this._imageData = await this._img.raw().toBuffer({ resolveWithObject: true });
        }
        return this._imageData;
    }

    private async _forceRefreshImageData(): Promise<void> {
        this._imageData = await this._img.raw().toBuffer({ resolveWithObject: true });
        this._img = sharp(this._imageData.data, {
            raw: {
                width: this._imageData.info.width,
                height: this._imageData.info.height,
                channels: this._imageData.info.channels,
            },
        });

        this._composeImages = [];
        this._ignoreData = [];
    }

    async getRGBA(x: number, y: number): Promise<RGBA> {
        const { data, info } = await this._getImageData();
        const idx = (info.width * y + x) * info.channels;

        return {
            r: data[idx],
            g: data[idx + 1],
            b: data[idx + 2],
            a: info.channels === 4 ? data[idx + 3] : 1,
        };
    }

    async save(file: string): Promise<void> {
        await this._img.png().toFile(file);
    }

    static fromBase64(base64: string): Image {
        return new this(Buffer.from(base64, "base64"));
    }

    async toPngBuffer(opts: { resolveWithObject: true }): Promise<PngImageData>;
    async toPngBuffer(opts: { resolveWithObject?: false }): Promise<Buffer>;
    async toPngBuffer(
        opts: { resolveWithObject?: boolean } = { resolveWithObject: true },
    ): Promise<PngImageData | Buffer> {
        if (opts.resolveWithObject) {
            const imgData = await this._img.png().toBuffer({ resolveWithObject: true });

            return { data: imgData.data, size: { height: imgData.info.height, width: imgData.info.width } };
        }

        return await this._img.png().toBuffer({ resolveWithObject: false });
    }

    static compare(path1: string, path2: string, opts: CompareOptions = {}): Promise<looksSame.LooksSameResult> {
        const compareOptions: looksSame.LooksSameOptions = {
            ignoreCaret: opts.canHaveCaret,
            pixelRatio: opts.pixelRatio,
            ...opts.compareOpts,
        };
        if (opts.tolerance) {
            compareOptions.tolerance = opts.tolerance;
        }
        if (opts.antialiasingTolerance) {
            compareOptions.antialiasingTolerance = opts.antialiasingTolerance;
        }

        return looksSame(path1, path2, { ...compareOptions, createDiffImage: true });
    }

    static buildDiff(opts: DiffOptions): Promise<null> {
        const { diffColor: highlightColor, ...otherOpts } = opts;
        const diffOptions = { highlightColor, ...otherOpts };

        return looksSame.createDiff(diffOptions);
    }
}
