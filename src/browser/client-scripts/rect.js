"use strict";

var util = require("./util");

function Rect(data) {
    this.top = data.top;
    this.left = data.left;

    if ("width" in data && "height" in data) {
        this.width = data.width;
        this.height = data.height;
        this.bottom = data.bottom || this.top + this.height;
        this.right = data.right || this.left + this.width;
    } else if ("bottom" in data && "right" in data) {
        this.bottom = data.bottom;
        this.right = data.right;
        this.width = data.right - Math.max(0, data.left);
        this.height = data.bottom - Math.max(0, data.top);
    } else {
        throw new Error("Not enough data for the rect construction");
    }
}

Rect.isRect = function (data) {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
        return false;
    }

    return (
        "left" in data &&
        "top" in data &&
        (("width" in data && "height" in data) || ("right" in data && "bottom" in data))
    );
};

Rect.prototype = {
    constructor: Rect,
    merge: function (otherRect) {
        return new Rect({
            left: Math.min(this.left, otherRect.left),
            top: Math.min(this.top, otherRect.top),
            bottom: Math.max(this.bottom, otherRect.bottom),
            right: Math.max(this.right, otherRect.right)
        });
    },

    translate: function (x, y) {
        return new Rect({
            left: this.left + x,
            top: this.top + y,
            width: this.width,
            height: this.height
        });
    },

    pointInside: function (x, y) {
        return x >= this.left && x <= this.right && y >= this.top && y <= this.bottom;
    },

    rectInside: function (rect) {
        return util.every(
            rect._keyPoints(),
            function (point) {
                return this.pointInside(point[0], point[1]);
            },
            this
        );
    },

    rectIntersects: function (other) {
        var isOtherOutside =
            other.right <= this.left ||
            other.bottom <= this.top ||
            other.left >= this.right ||
            other.top >= this.bottom;

        return !isOtherOutside;
    },

    round: function () {
        return new Rect({
            top: Math.round(this.top),
            left: Math.round(this.left),
            bottom: Math.round(this.top + this.height),
            right: Math.round(this.left + this.width)
        });
    },

    scale: function (scaleFactor) {
        var rect = new Rect({
            top: this.top * scaleFactor,
            left: this.left * scaleFactor,
            right: this.right * scaleFactor,
            bottom: this.bottom * scaleFactor
        });

        return util.isInteger(scaleFactor) ? rect : rect.round();
    },

    serialize: function () {
        return {
            left: this.left,
            top: this.top,
            width: this.width,
            height: this.height
        };
    },

    overflowsTopBound: function (rect) {
        return this._overflowsBound(rect, "top");
    },

    overflowsLeftBound: function (rect) {
        return this._overflowsBound(rect, "left");
    },

    /** @type Function */
    recalculateHeight: function (rect) {
        this.height = this.height - (rect.top - Math.max(0, this.top));
    },

    /** @type Function */
    recalculateWidth: function (rect) {
        this.width = this.width - (rect.left - Math.max(0, this.left));
    },

    _overflowsBound: function (rect, prop) {
        return Math.max(0, this[prop]) < rect[prop];
    },

    _anyPointInside: function (points) {
        return util.some(
            points,
            function (point) {
                return this.pointInside(point[0], point[1]);
            },
            this
        );
    },

    _keyPoints: function () {
        return [
            [this.left, this.top],
            [this.left, this.bottom],
            [this.right, this.top],
            [this.right, this.bottom]
        ];
    }
};

exports.Rect = Rect;
exports.getAbsoluteClientRect = function getAbsoluteClientRect(element, opts, logger) {
    var coords = getNestedBoundingClientRect(element, window);
    var widthRatio = coords.width % opts.viewportWidth;
    var heightRatio = coords.height % opts.documentHeight;

    var clientRect = new Rect({
        left: coords.left,
        top: coords.top,
        // to correctly calculate "width" and "height" in devices with fractional pixelRatio
        width: widthRatio > 0 && widthRatio < 1 ? opts.viewportWidth : coords.width,
        height: heightRatio > 0 && heightRatio < 1 ? opts.documentHeight : coords.height
    });

    logger("getAbsoluteClientRect, client rect: ", clientRect);

    var scrollLeft = util.isRootElement(opts.scrollElem)
        ? util.getScrollLeft(window)
        : util.getScrollLeft(opts.scrollElem) + util.getScrollLeft(window);
    var scrollTop = util.isRootElement(opts.scrollElem)
        ? util.getScrollTop(window)
        : util.getScrollTop(opts.scrollElem) + util.getScrollTop(window);

    logger("getAbsoluteClientRect, is scroll element window? : ", util.isRootElement(opts.scrollElem));
    logger("getAbsoluteClientRect, scrollTop: ", scrollTop);

    return clientRect.translate(scrollLeft, scrollTop);
};

function getNestedBoundingClientRect(node, boundaryWindow) {
    var ownerIframe = util.getOwnerIframe(node);
    if (ownerIframe === null || util.getOwnerWindow(ownerIframe) === boundaryWindow) {
        return node.getBoundingClientRect();
    }

    var rects = [node.getBoundingClientRect()];
    var currentIframe = ownerIframe;

    while (currentIframe) {
        var rect = getBoundingClientRectWithBorderOffset(currentIframe);
        rects.push(rect);

        currentIframe = util.getOwnerIframe(currentIframe);
        if (currentIframe && util.getOwnerWindow(currentIframe) === boundaryWindow) {
            rect = getBoundingClientRectWithBorderOffset(currentIframe);
            rects.push(rect);
            break;
        }
    }

    return mergeRectOffsets(rects);
}

function getBoundingClientRectWithBorderOffset(node) {
    var dimensions = getElementDimensions(node);

    return mergeRectOffsets([
        node.getBoundingClientRect(),
        {
            top: dimensions.borderTop,
            left: dimensions.borderLeft,
            bottom: dimensions.borderBottom,
            right: dimensions.borderRight,
            x: dimensions.borderLeft,
            y: dimensions.borderTop
        }
    ]);
}

function getElementDimensions(element) {
    var calculatedStyle = util.getOwnerWindow(element).getComputedStyle(element);

    return {
        borderLeft: parseFloat(calculatedStyle.borderLeftWidth),
        borderRight: parseFloat(calculatedStyle.borderRightWidth),
        borderTop: parseFloat(calculatedStyle.borderTopWidth),
        borderBottom: parseFloat(calculatedStyle.borderBottomWidth)
    };
}

function mergeRectOffsets(rects) {
    return rects.reduce(function (previousRect, rect) {
        if (previousRect === null) {
            return rect;
        }

        var nextTop = previousRect.top + rect.top;
        var nextLeft = previousRect.left + rect.left;

        return {
            top: nextTop,
            left: nextLeft,
            width: previousRect.width,
            height: previousRect.height,
            bottom: nextTop + previousRect.height,
            right: nextLeft + previousRect.width,
            x: nextLeft,
            y: nextTop
        };
    });
}
