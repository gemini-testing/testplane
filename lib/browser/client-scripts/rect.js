'use strict';

var util = require('./util');

function Rect(data) {
    this.top = data.top;
    this.left = data.left;

    if ('width' in data && 'height' in data) {
        this.width = data.width;
        this.height = data.height;
        this.bottom = data.bottom || this.top + this.height;
        this.right = data.right || this.left + this.width;
    } else if ('bottom' in data && 'right' in data) {
        this.bottom = data.bottom;
        this.right = data.right;
        this.width = data.right - Math.max(0, data.left);
        this.height = data.bottom - Math.max(0, data.top);
    } else {
        throw new Error('Not enough data for the rect construction');
    }
}

Rect.isRect = function(data) {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        return false;
    }

    return 'left' in data && 'top' in data && (
        'width' in data && 'height' in data ||
        'right' in data && 'bottom' in data
    );
};

Rect.prototype = {
    constructor: Rect,
    merge: function(otherRect) {
        return new Rect({
            left: Math.min(this.left, otherRect.left),
            top: Math.min(this.top, otherRect.top),
            bottom: Math.max(this.bottom, otherRect.bottom),
            right: Math.max(this.right, otherRect.right)
        });
    },

    translate: function(x, y) {
        return new Rect({
            left: this.left + x,
            top: this.top + y,
            width: this.width,
            height: this.height
        });
    },

    pointInside: function(x, y) {
        return x >= this.left && x <= this.right &&
            y >= this.top && y <= this.bottom;
    },

    rectInside: function(rect) {
        return util.every(rect._keyPoints(), function(point) {
            return this.pointInside(point[0], point[1]);
        }, this);
    },

    rectIntersects: function(other) {
        var isOtherOutside = other.right <= this.left || other.bottom <= this.top || other.left >= this.right || other.top >= this.bottom;

        return !isOtherOutside;
    },

    round: function() {
        return new Rect({
            top: Math.floor(this.top),
            left: Math.floor(this.left),
            right: Math.ceil(this.right),
            bottom: Math.ceil(this.bottom)
        });
    },

    serialize: function() {
        return {
            left: this.left,
            top: this.top,
            width: this.width,
            height: this.height
        };
    },

    overflowsTopBound: function(rect) {
        return this._overflowsBound(rect, 'top');
    },

    overflowsLeftBound: function(rect) {
        return this._overflowsBound(rect, 'left');
    },

    recalculateHeight: function(rect) {
        this.height = this.height - (rect.top - Math.max(0, this.top));
    },

    recalculateWidth: function(rect) {
        this.width = this.width - (rect.left - Math.max(0, this.left));
    },

    _overflowsBound: function(rect, prop) {
        return Math.max(0, this[prop]) < rect[prop];
    },

    _anyPointInside: function(points) {
        return util.some(points, function(point) {
            return this.pointInside(point[0], point[1]);
        }, this);
    },

    _keyPoints: function() {
        return [
            [this.left, this.top],
            [this.left, this.bottom],
            [this.right, this.top],
            [this.right, this.bottom]
        ];
    }
};

exports.Rect = Rect;
exports.getAbsoluteClientRect = function getAbsoluteClientRect(element, scrollElem) {
    var clientRect = new Rect(element.getBoundingClientRect());
    return clientRect.translate(util.getScrollLeft(scrollElem), util.getScrollTop(scrollElem));
};
