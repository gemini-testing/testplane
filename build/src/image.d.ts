export = Image;
declare class Image {
    static create(buffer: any): import("./image");
    static fromBase64(base64: any): import("./image");
    static compare(path1: any, path2: any, opts?: {}): globalThis.Promise<looksSame.LooksSameBaseResult>;
    static buildDiff(opts: any): globalThis.Promise<null>;
    constructor(buffer: any);
    _img: sharp.Sharp;
    _imageData: {
        data: Buffer;
        info: sharp.OutputInfo;
    } | null;
    _ignoreData: any[];
    _composeImages: any[];
    getSize(): globalThis.Promise<{
        width: number;
        height: number;
    }>;
    crop(rect: any): globalThis.Promise<void>;
    addJoin(attachedImages: any): void;
    applyJoin(): globalThis.Promise<void>;
    addClear({ width, height, left, top }: {
        width: any;
        height: any;
        left: any;
        top: any;
    }): globalThis.Promise<void>;
    applyClear(): void;
    _getImageData(): globalThis.Promise<{
        data: Buffer;
        info: sharp.OutputInfo;
    }>;
    _forceRefreshImageData(): globalThis.Promise<void>;
    getRGBA(x: any, y: any): globalThis.Promise<{
        r: number;
        g: number;
        b: number;
        a: number;
    }>;
    save(file: any): globalThis.Promise<void>;
    toPngBuffer(opts?: {
        resolveWithObject: boolean;
    }): globalThis.Promise<(Buffer & {
        data: Buffer;
        info: sharp.OutputInfo;
    }) | {
        data: Buffer;
        size: {
            height: number;
            width: number;
        };
    }>;
}
import sharp = require("sharp");
import looksSame = require("looks-same");
