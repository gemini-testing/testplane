"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
exports.__esModule = true;
exports.getAbsoluteClientRect = void 0;
var util = __importStar(require("./util"));
function hasWidthAndHeight(data) {
    return 'width' in data && 'height' in data;
}
function hasRightAndBottom(data) {
    return 'right' in data && 'bottom' in data;
}
var Rect = /** @class */ (function () {
    function Rect(data) {
        this.top = data.top;
        this.left = data.left;
        if (hasWidthAndHeight(data)) {
            this.width = data.width;
            this.height = data.height;
            this.right = data.right || this.left + this.width;
            this.bottom = data.bottom || this.top + this.height;
        }
        else if (hasRightAndBottom(data)) {
            this.right = data.right;
            this.bottom = data.bottom;
            this.width = data.right - Math.max(0, data.left);
            this.height = data.bottom - Math.max(0, data.top);
        }
        else {
            throw new Error('Not enough data for the rect construction');
        }
    }
    Rect.isRect = function (data) {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
            return false;
        }
        return 'left' in data && 'top' in data && ('width' in data && 'height' in data ||
            'right' in data && 'bottom' in data);
    };
    Rect.prototype.merge = function (otherRect) {
        return new Rect({
            left: Math.min(this.left, otherRect.left),
            top: Math.min(this.top, otherRect.top),
            bottom: Math.max(this.bottom, otherRect.bottom),
            right: Math.max(this.right, otherRect.right)
        });
    };
    Rect.prototype.translate = function (x, y) {
        return new Rect({
            top: this.top + y,
            left: this.left + x,
            width: this.width,
            height: this.height
        });
    };
    Rect.prototype.pointInside = function (x, y) {
        return x >= this.left && x <= this.right &&
            y >= this.top && y <= this.bottom;
    };
    Rect.prototype.rectInside = function (rect) {
        return util.every(rect._keyPoints(), function (point) {
            return this.pointInside(point[0], point[1]);
        }, this);
    };
    Rect.prototype.rectIntersects = function (other) {
        var isOtherOutside = other.right <= this.left || other.bottom <= this.top || other.left >= this.right || other.top >= this.bottom;
        return !isOtherOutside;
    };
    Rect.prototype.round = function () {
        return new Rect({
            top: Math.floor(this.top),
            left: Math.floor(this.left),
            right: Math.ceil(this.right),
            bottom: Math.ceil(this.bottom)
        });
    };
    Rect.prototype.serialize = function () {
        return {
            top: this.top,
            left: this.left,
            width: this.width,
            height: this.height
        };
    };
    Rect.prototype.overflowsTopBound = function (rect) {
        return this._overflowsBound(rect, 'top');
    };
    Rect.prototype.overflowsLeftBound = function (rect) {
        return this._overflowsBound(rect, 'left');
    };
    Rect.prototype.recalculateHeight = function (rect) {
        this.height = this.height - (rect.top - Math.max(0, this.top));
    };
    Rect.prototype.recalculateWidth = function (rect) {
        this.width = this.width - (rect.left - Math.max(0, this.left));
    };
    Rect.prototype._overflowsBound = function (rect, prop) {
        return Math.max(0, this[prop]) < rect[prop];
    };
    Rect.prototype._keyPoints = function () {
        return [
            [this.left, this.top],
            [this.left, this.bottom],
            [this.right, this.top],
            [this.right, this.bottom]
        ];
    };
    return Rect;
}());
exports["default"] = Rect;
function getAbsoluteClientRect(element, scrollElem) {
    var clientRect = new Rect(element.getBoundingClientRect());
    return clientRect.translate(util.getScrollLeft(scrollElem), util.getScrollTop(scrollElem));
}
exports.getAbsoluteClientRect = getAbsoluteClientRect;
