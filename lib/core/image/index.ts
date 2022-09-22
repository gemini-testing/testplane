import Bluebird from 'bluebird';
import looksSame from 'looks-same';
import {PngImg} from 'png-img';
import utils from 'png-img/utils';

import type {Color, Size} from 'png-img/dist/types';

import SafeRect from './safe-rect';

import type { SerializedRect } from '../types/rect';

type ImageCompareOpts = {
    canHaveCaret?: boolean;
    pixelRatio?: number;
    compareOpts?: looksSame.LooksSameOptions;
    tolerance?: number;
    antialiasingTolerance?: number;
};

type ImageBuildDiffOpts = Omit<looksSame.CreateDiffOptions, 'highlightColor'> & {
    diffColor: string;
};
type ImageBuildDiffAsBufferOpts = Omit<looksSame.CreateDiffAsBufferOptions, 'highlightColor'> & {
    diffColor: string;
};

type ScaleOpts = {
    scaleFactor?: number;
};

export default class Image {
    private _img: PngImg;

    static create(buffer: Buffer): Image {
        return new this(buffer);
    }

    constructor(buffer: Buffer) {
        this._img = new PngImg(buffer);
    }

    crop(rect: SerializedRect, opts: ScaleOpts = {}): Promise<this> {
        rect = this._scale(rect, opts.scaleFactor);

        const imageSize = this.getSize();
        const safeRect = SafeRect.create(rect, imageSize);

        this._img.crop(
            safeRect.left,
            safeRect.top,
            safeRect.width,
            safeRect.height
        );

        return Bluebird.resolve(this);
    }

    getSize(): Size {
        return this._img.size();
    }

    getRGBA(x: number, y: number): Color {
        return this._img.get(x, y);
    }

    save(file: string): Promise<void> {
        return this._img.save(file);
    }

    clear(area: SerializedRect, opts: ScaleOpts = {}): void {
        area = this._scale(area, opts.scaleFactor);
        this._img.fill(
            area.left,
            area.top,
            area.width,
            area.height,
            '#000000'
        );
    }

    join(newImage: Image): this {
        const imageSize = this.getSize();

        this._img
            .setSize(imageSize.width, imageSize.height + newImage.getSize().height)
            .insert(newImage._img, 0, imageSize.height);

        return this;
    }

    private _scale(area: SerializedRect, scaleFactor: number = 1): SerializedRect {
        return {
            left: area.left * scaleFactor,
            top: area.top * scaleFactor,
            width: area.width * scaleFactor,
            height: area.height * scaleFactor
        };
    }

    static fromBase64(base64: string): Image {
        return new Image(Buffer.from(base64, 'base64'));
    }

    static RGBToString(rgb: Color): string {
        return utils.RGBToString(rgb);
    }

    static compare(path1: string, path2: string, opts: ImageCompareOpts = {}): Promise<looksSame.LooksSameResult> {
        const compareOptions: looksSame.LooksSameOptions = {
            ignoreCaret: opts.canHaveCaret,
            pixelRatio: opts.pixelRatio,
            ...opts.compareOpts
        };

        (['tolerance', 'antialiasingTolerance'] as const).forEach((option) => {
            if (option in opts) {
                compareOptions[option] = opts[option];
            }
        });

        return looksSame(path1, path2, compareOptions);
    }

    static buildDiff(opts: ImageBuildDiffOpts): Promise<null>;
    static buildDiff(opts: ImageBuildDiffAsBufferOpts): Promise<Buffer>;
    static buildDiff(opts: ImageBuildDiffAsBufferOpts | ImageBuildDiffOpts): Promise<Buffer | null> {
        const {diffColor: highlightColor, ...otherOpts} = opts;
        const diffOptions = {highlightColor, ...otherOpts};

        return looksSame.createDiff(diffOptions);
    }
}
