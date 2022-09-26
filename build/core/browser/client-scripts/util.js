"use strict";
exports.__esModule = true;
exports.isSafariMobile = exports.getScrollLeft = exports.getScrollTop = exports.every = exports.some = exports.each = void 0;
var SCROLL_DIR_NAME;
(function (SCROLL_DIR_NAME) {
    SCROLL_DIR_NAME["top"] = "scrollTop";
    SCROLL_DIR_NAME["left"] = "scrollLeft";
})(SCROLL_DIR_NAME || (SCROLL_DIR_NAME = {}));
var PAGE_OFFSET_NAME;
(function (PAGE_OFFSET_NAME) {
    PAGE_OFFSET_NAME["x"] = "pageXOffset";
    PAGE_OFFSET_NAME["y"] = "pageYOffset";
})(PAGE_OFFSET_NAME || (PAGE_OFFSET_NAME = {}));
exports.each = arrayUtil(Array.prototype.forEach, myForEach);
exports.some = arrayUtil(Array.prototype.some, mySome);
exports.every = arrayUtil(Array.prototype.every, myEvery);
function arrayUtil(nativeFunc, shimFunc) {
    return nativeFunc ? contextify(nativeFunc) : shimFunc;
}
/**
 * Makes function f to accept context as a
 * first argument
 */
function contextify(f) {
    return function (ctx) {
        var rest = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            rest[_i - 1] = arguments[_i];
        }
        return f.apply(ctx, rest);
    };
}
function myForEach(array, cb, context) {
    for (var i = 0; i < array.length; i++) {
        cb.call(context, array[i], i, array);
    }
}
function mySome(array, cb, context) {
    for (var i = 0; i < array.length; i++) {
        if (cb.call(context, array[i], i, array)) {
            return true;
        }
    }
    return false;
}
function myEvery(array, cb, context) {
    for (var i = 0; i < array.length; i++) {
        if (!cb.call(context, array[i], i, array)) {
            return false;
        }
    }
    return true;
}
function getScroll(scrollElem, direction, coord) {
    var scrollDir = SCROLL_DIR_NAME[direction];
    var pageOffset = PAGE_OFFSET_NAME[coord];
    if (scrollElem && !isWindow(scrollElem)) {
        return scrollElem[scrollDir];
    }
    if (typeof window[pageOffset] !== 'undefined') {
        return window[pageOffset];
    }
    return document.documentElement[scrollDir];
}
function isWindow(elem) {
    return elem !== window;
}
function getScrollTop(scrollElem) {
    return getScroll(scrollElem, 'top', 'y');
}
exports.getScrollTop = getScrollTop;
function getScrollLeft(scrollElem) {
    return getScroll(scrollElem, 'left', 'x');
}
exports.getScrollLeft = getScrollLeft;
function isSafariMobile() {
    return navigator
        && typeof navigator.vendor === 'string'
        && Boolean(navigator.vendor.match(/apple/i))
        && /(iPhone|iPad).*AppleWebKit.*Safari/i.test(navigator.userAgent);
}
exports.isSafariMobile = isSafariMobile;
