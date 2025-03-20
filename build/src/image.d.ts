/// <reference types="node" />
import looksSame from "looks-same";
import { DiffOptions, ImageSize } from "./types";
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
export declare class Image {
    private _img;
    private _imageData;
    private _ignoreData;
    private _composeImages;
    static create(buffer: Buffer): Image;
    constructor(buffer: Buffer);
    getSize(): Promise<ImageSize>;
    crop(rect: Rect): Promise<void>;
    addJoin(attachedImages: Image[]): void;
    applyJoin(): Promise<void>;
    addClear({ width, height, left, top }: Rect): Promise<void>;
    applyClear(): void;
    private _getImageData;
    private _forceRefreshImageData;
    getRGBA(x: number, y: number): Promise<RGBA>;
    save(file: string): Promise<void>;
    static fromBase64(base64: string): Image;
    toPngBuffer(opts: {
        resolveWithObject: true;
    }): Promise<PngImageData>;
    toPngBuffer(opts: {
        resolveWithObject?: false;
    }): Promise<Buffer>;
    static compare(path1: string, path2: string, opts?: CompareOptions): Promise<looksSame.LooksSameResult>;
    static buildDiff(opts: DiffOptions): Promise<null>;
}
export {};
