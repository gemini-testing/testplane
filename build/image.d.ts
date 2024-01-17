export = Image;
declare class Image {
    static create(buffer: any): import("./image");
    static fromBase64(base64: any): import("./image");
    static compare(path1: any, path2: any, opts?: {}): Promise<looksSame.LooksSameBaseResult>;
    static buildDiff(opts: any): Promise<null>;
    constructor(buffer: any);
    _img: sharp.Sharp;
    _imageData: {
        data: Buffer;
        info: sharp.OutputInfo;
    } | null;
    _ignoreData: any[];
    _composeImages: any[];
    getSize(): Promise<any>;
    crop(rect: any): Promise<void>;
    addJoin(attachedImages: any): void;
    applyJoin(): Promise<void>;
    addClear({ width, height, left, top }: {
        width: any;
        height: any;
        left: any;
        top: any;
    }): Promise<void>;
    applyClear(): void;
    _getImageData(): Promise<{
        data: Buffer;
        info: sharp.OutputInfo;
    }>;
    _forceRefreshImageData(): Promise<void>;
    getRGBA(x: any, y: any): Promise<{
        r: number;
        g: number;
        b: number;
        a: number;
    }>;
    save(file: any): Promise<void>;
    toPngBuffer(opts?: {
        resolveWithObject: boolean;
    }): Promise<(Buffer & {
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
