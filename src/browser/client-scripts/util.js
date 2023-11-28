"use strict";

var SCROLL_DIR_NAME = {
    top: "scrollTop",
    left: "scrollLeft"
};

var PAGE_OFFSET_NAME = {
    x: "pageXOffset",
    y: "pageYOffset"
};

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
        var rest = Array.prototype.slice.call(arguments, 1);
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

    if (scrollElem && scrollElem !== window) {
        return scrollElem[scrollDir];
    }

    if (typeof window[pageOffset] !== "undefined") {
        return window[pageOffset];
    }

    return document.documentElement[scrollDir];
}

exports.getScrollTop = function (scrollElem) {
    return getScroll(scrollElem, "top", "y");
};

exports.getScrollLeft = function (scrollElem) {
    return getScroll(scrollElem, "left", "x");
};

exports.isSafariMobile = function () {
    return (
        navigator &&
        typeof navigator.vendor === "string" &&
        navigator.vendor.match(/apple/i) &&
        /(iPhone|iPad).*AppleWebKit.*Safari/i.test(navigator.userAgent)
    );
};

exports.isInteger = function (num) {
    return num % 1 === 0;
};

exports.forEachRoot = function (cb) {
    function traverseRoots(root) {
        cb(root);

        // In IE 11, we need to pass the third and fourth arguments
        var treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);

        for (var node = treeWalker.currentNode; node !== null; node = treeWalker.nextNode()) {
            if (node instanceof Element && node.shadowRoot) {
                traverseRoots(node.shadowRoot);
            }
        }
    }

    traverseRoots(document.documentElement);
};
