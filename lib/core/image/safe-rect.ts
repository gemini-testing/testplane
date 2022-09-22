import {Size} from "png-img/dist/types";

import { Coordinate, SerializedRect } from '../types/rect';

export default class SafeRect {
    static create(rect: SerializedRect, imageSize: Size): SafeRect {
        return new SafeRect(rect, imageSize);
    }

    constructor(private _rect: SerializedRect, private _imageSize: Size) {}

    get left(): number {
        return this._calcCoord('left');
    }

    get top(): number {
        return this._calcCoord('top');
    }

    private _calcCoord(coord: keyof Coordinate): number {
        return Math.max(this._rect[coord], 0);
    }

    get width(): number {
        return this._calcSize('width', 'left');
    }

    get height(): number {
        return this._calcSize('height', 'top');
    }

    private _calcSize(size: keyof Size, coord: keyof Coordinate): number {
        const rectCoord = this._calcCoord(coord);

        return Math.min(this._rect[size], this._imageSize[size] - rectCoord);
    }
}
