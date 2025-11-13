import fs from "fs";
import looksSame from "looks-same";
import { loadEsm } from "./utils/preload-utils";
import { DiffOptions, ImageSize } from "./types";
import { convertRgbaToPng } from "./utils/eight-bit-rgba-to-png";
import { BITS_IN_BYTE, PNG_HEIGHT_OFFSET, PNG_WIDTH_OFFSET, RGBA_CHANNELS } from "./constants/png";

interface PngImageData {
    data: Buffer;
    size: ImageSize;
}

export interface Rect {
    width: number;
    height: number;
    top: number;
    left: number;
}

export interface RGB {
    R: number;
    G: number;
    B: number;
}

interface CompareOptions {
    canHaveCaret?: boolean;
    pixelRatio?: number;
    compareOpts?: looksSame.LooksSameOptions;
    tolerance?: number;
    antialiasingTolerance?: number;
}

const initJsquashPromise = new Promise<unknown>(resolve => {
    const wasmLocation = require.resolve("@jsquash/png/codec/pkg/squoosh_png_bg.wasm");

    Promise.all([
        loadEsm<typeof import("@jsquash/png/decode.js")>("@jsquash/png/decode.js"),
        fs.promises.readFile(wasmLocation),
    ])
        .then(([mod, wasmBytes]) => mod.init(wasmBytes))
        .then(resolve);
});

const jsquashDecode = (buffer: ArrayBuffer): Promise<ImageData> => {
    return Promise.all([
        loadEsm<typeof import("@jsquash/png/decode.js")>("@jsquash/png/decode.js"),
        initJsquashPromise,
    ]).then(([mod]) => mod.decode(buffer, { bitDepth: BITS_IN_BYTE }));
};

export class Image {
    private _imgDataPromise: Promise<Buffer>;
    private _imgData: Buffer | null = null;
    private _width: number;
    private _height: number;
    private _composeImages: this[] = [];

    static create(buffer: Buffer): Image {
        return new this(buffer);
    }

    constructor(buffer: Buffer) {
        this._width = buffer.readUInt32BE(PNG_WIDTH_OFFSET);
        this._height = buffer.readUInt32BE(PNG_HEIGHT_OFFSET);
        this._imgDataPromise = jsquashDecode(buffer).then(({ data }) => {
            return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
        });
    }

    async _getImgData(): Promise<Buffer> {
        if (this._imgData) {
            return this._imgData;
        }

        return (this._imgData = await this._imgDataPromise);
    }

    _ensureImagesHaveSameWidth(): void {
        for (const image of this._composeImages) {
            if (image._width !== this._width) {
                throw new Error(
                    [
                        `It looks like viewport width changed while performing long page screenshot (${this._width}px -> ${image._width}px)`,
                        "Please make sure page is fully loaded before making screenshot",
                    ].join("\n"),
                );
            }
        }
    }

    async getSize(): Promise<ImageSize> {
        this._ensureImagesHaveSameWidth();

        const height = this._composeImages.reduce((acc, img) => acc + img._height, this._height);

        return { height, width: this._width };
    }

    async crop(rect: Rect): Promise<void> {
        const imgData = await this._getImgData();

        let bufferPointer = 0;
        let sourceOffset = (rect.top * this._width + rect.left) * RGBA_CHANNELS;

        const bytesToCopy = Math.min(rect.width, this._width - rect.left) * RGBA_CHANNELS;
        const bytesToIterate = this._width * RGBA_CHANNELS;

        for (let i = 0; i < Math.min(rect.height, this._height - rect.top); i++) {
            imgData.copy(imgData, bufferPointer, sourceOffset, sourceOffset + bytesToCopy);

            bufferPointer += bytesToCopy;
            sourceOffset += bytesToIterate;
        }

        this._imgData = imgData.subarray(0, bufferPointer);
        this._width = rect.width;
        this._height = rect.height;
    }

    addJoin(attachedImages: this[]): void {
        this._composeImages = this._composeImages.concat(attachedImages);
    }

    async applyJoin(): Promise<void> {
        if (!this._composeImages.length) return;

        this._ensureImagesHaveSameWidth();

        const resultHeight = this._composeImages.reduce((acc, img) => acc + img._height, this._height);
        const imageBuffers = await Promise.all([this, ...this._composeImages].map(img => img._getImgData()));

        this._imgData = Buffer.concat(imageBuffers);
        this._height = resultHeight;
        this._composeImages = [];
    }

    async clearArea(rect: Rect): Promise<void> {
        const imgData = await this._getImgData();

        let sourceOffset = (rect.top * this._width + rect.left) * RGBA_CHANNELS;

        const bytesToCopyAmount = Math.min(rect.width, this._width - rect.left) * RGBA_CHANNELS;
        const bytesToIterate = this._width * RGBA_CHANNELS;
        const bytesToFill = Buffer.from([0, 0, 0, 255]); // black RGBA

        for (let i = 0; i < Math.min(rect.height, this._height - rect.top); i++) {
            imgData.fill(bytesToFill, sourceOffset, sourceOffset + bytesToCopyAmount);

            sourceOffset += bytesToIterate;
        }
    }

    async getRGB(x: number, y: number): Promise<RGB> {
        const imgData = await this._getImgData();
        const idx = (this._width * y + x) * RGBA_CHANNELS;

        return {
            R: imgData[idx],
            G: imgData[idx + 1],
            B: imgData[idx + 2],
        };
    }

    async _getPngBuffer(): Promise<Buffer> {
        const imageData = await this._getImgData();

        return convertRgbaToPng(imageData, this._width, this._height);
    }

    async save(file: string): Promise<void> {
        const data = await this._getPngBuffer();

        await fs.promises.writeFile(file, data);
    }

    static fromBase64(base64: string): Image {
        return new this(Buffer.from(base64, "base64"));
    }

    async toPngBuffer(opts: { resolveWithObject: true }): Promise<PngImageData>;
    async toPngBuffer(opts: { resolveWithObject?: false }): Promise<Buffer>;
    async toPngBuffer(
        opts: { resolveWithObject?: boolean } = { resolveWithObject: true },
    ): Promise<PngImageData | Buffer> {
        const data = await this._getPngBuffer();

        return opts.resolveWithObject ? { data, size: { width: this._width, height: this._height } } : data;
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
