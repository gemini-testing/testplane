"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class SafeRect {
    constructor(_rect, _imageSize) {
        this._rect = _rect;
        this._imageSize = _imageSize;
    }
    static create(rect, imageSize) {
        return new SafeRect(rect, imageSize);
    }
    get left() {
        return this._calcCoord('left');
    }
    get top() {
        return this._calcCoord('top');
    }
    _calcCoord(coord) {
        return Math.max(this._rect[coord], 0);
    }
    get width() {
        return this._calcSize('width', 'left');
    }
    get height() {
        return this._calcSize('height', 'top');
    }
    _calcSize(size, coord) {
        const rectCoord = this._calcCoord(coord);
        return Math.min(this._rect[size], this._imageSize[size] - rectCoord);
    }
}
exports.default = SafeRect;
