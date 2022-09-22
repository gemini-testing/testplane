import * as util from './util';

import type {SerializedRect} from '../../types/rect';

type RectConstructor = {
    top: number;
    left: number;
    right?: number;
    bottom?: number;
    width?: number;
    height?: number;
};

function hasWidthAndHeight<T>(data: T): data is T & Record<'width'|'height', number> {
    return 'width' in data && 'height' in data;
}

function hasRightAndBottom<T>(data: T): data is T & Record<'right'|'bottom', number> {
    return 'right' in data && 'bottom' in data;
}

export default class Rect {
    top: number;
    left: number;
    right: number;
    bottom: number;
    width: number;
    height: number;

    constructor(data: RectConstructor) {
        this.top = data.top;
        this.left = data.left;

        if (hasWidthAndHeight(data)) {
            this.width = data.width;
            this.height = data.height;
            this.right = data.right || this.left + this.width;
            this.bottom = data.bottom || this.top + this.height;
        } else if (hasRightAndBottom(data)) {
            this.right = data.right;
            this.bottom = data.bottom;
            this.width = data.right - Math.max(0, data.left);
            this.height = data.bottom - Math.max(0, data.top);
        } else {
            throw new Error('Not enough data for the rect construction');
        }
    }

    static isRect(data: unknown): data is Rect {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
            return false;
        }

        return 'left' in data && 'top' in data && (
            'width' in data && 'height' in data ||
            'right' in data && 'bottom' in data
        );
    }

    merge(otherRect: Rect): Rect {
        return new Rect({
            left: Math.min(this.left, otherRect.left),
            top: Math.min(this.top, otherRect.top),
            bottom: Math.max(this.bottom, otherRect.bottom),
            right: Math.max(this.right, otherRect.right)
        });
    }

    translate(x: number, y: number): Rect {
        return new Rect({
            top: this.top + y,
            left: this.left + x,
            width: this.width,
            height: this.height
        });
    }

    pointInside(x: number, y: number): boolean {
        return x >= this.left && x <= this.right &&
            y >= this.top && y <= this.bottom;
    }

    rectInside(rect: Rect): boolean {
        return util.every(rect._keyPoints(), function(point: [number, number]) {
            return this.pointInside(point[0], point[1]);
        }, this);
    }

    rectIntersects(other: Rect): boolean {
        const isOtherOutside = other.right <= this.left || other.bottom <= this.top || other.left >= this.right || other.top >= this.bottom;

        return !isOtherOutside;
    }

    round(): Rect {
        return new Rect({
            top: Math.floor(this.top),
            left: Math.floor(this.left),
            right: Math.ceil(this.right),
            bottom: Math.ceil(this.bottom)
        });
    }

    serialize(): SerializedRect {
        return {
            top: this.top,
            left: this.left,
            width: this.width,
            height: this.height
        };
    }

    overflowsTopBound(rect: Rect): boolean {
        return this._overflowsBound(rect, 'top');
    }

    overflowsLeftBound(rect: Rect): boolean {
        return this._overflowsBound(rect, 'left');
    }

    recalculateHeight(rect: Rect): void {
        this.height = this.height - (rect.top - Math.max(0, this.top));
    }

    recalculateWidth(rect: Rect): void {
        this.width = this.width - (rect.left - Math.max(0, this.left));
    }

    private _overflowsBound(rect: Rect, prop: keyof SerializedRect): boolean {
        return Math.max(0, this[prop]) < rect[prop];
    }

    private _keyPoints(): Array<[number, number]> {
        return [
            [this.left, this.top],
            [this.left, this.bottom],
            [this.right, this.top],
            [this.right, this.bottom]
        ];
    }
}

export function getAbsoluteClientRect(element: Element, scrollElem?: Element | Window): Rect {
    const clientRect = new Rect(element.getBoundingClientRect());
    return clientRect.translate(util.getScrollLeft(scrollElem), util.getScrollTop(scrollElem));
}
