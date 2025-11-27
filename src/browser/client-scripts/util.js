"use strict";

var lib = require("./lib");

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

exports.getOwnerWindow = function (node) {
    if (!node.ownerDocument) {
        return null;
    }

    return node.ownerDocument.defaultView;
};

exports.getOwnerIframe = function (node) {
    var nodeWindow = exports.getOwnerWindow(node);
    if (nodeWindow) {
        return nodeWindow.frameElement;
    }

    return null;
};

exports.getMainDocumentElem = function (currDocumentElem) {
    if (!currDocumentElem) {
        currDocumentElem = document.documentElement;
    }

    var currIframe = exports.getOwnerIframe(currDocumentElem);
    if (!currIframe) {
        return currDocumentElem;
    }

    var currWindow = exports.getOwnerWindow(currIframe);
    if (!currWindow) {
        return currDocumentElem;
    }

    return exports.getMainDocumentElem(currWindow.document.documentElement);
};

exports.createDebugLogger = function createDebugLogger(opts) {
    var log = "";
    if (opts.debug) {
        return function () {
            for (var i = 0; i < arguments.length; i++) {
                if (typeof arguments[i] === "object") {
                    try {
                        log += JSON.stringify(arguments[i], null, 2) + "\n";
                    } catch (e) {
                        log += "failed to log message due to an error: " + e;
                    }
                } else {
                    log += arguments[i] + "\n";
                }
            }

            return log;
        };
    }

    return function () {};
};

function getParentNode(node) {
    if (!node) return null;
    if (node instanceof ShadowRoot) return node.host;
    if (node instanceof Element) {
        var root = node.getRootNode();
        return node.parentElement || (root instanceof ShadowRoot ? root.host : null);
    }
    return node.parentNode; // for Text/Comment nodes
}

exports.getScrollParent = function getScrollParent(element, logger) {
    if (element === null) {
        return null;
    }

    if (element === window) {
        return window;
    }

    var hasOverflow = element.scrollHeight > element.clientHeight;
    if (element instanceof Element) {
        var computedStyleOverflowY = lib.getComputedStyle(element).overflowY;
    } else {
        return getScrollParent(getParentNode(element), logger);
    }

    var canBeScrolled =
        computedStyleOverflowY === "auto" ||
        computedStyleOverflowY === "scroll" ||
        computedStyleOverflowY === "overlay";

    if (hasOverflow && canBeScrolled) {
        if (element.tagName === "BODY") {
            return window;
        }
        return element;
    } else {
        return getScrollParent(getParentNode(element), logger);
    }
};

exports.isRootElement = function (element) {
    return element === window || element.parentElement === null;
};

/* Returns an element relative to which given absolutely positioned element is positioned */
exports.findContainingBlock = function findContainingBlock(element) {
    var parent = element.parentElement;
    while (parent) {
        var style = lib.getComputedStyle(parent);
        if (
            ["relative", "absolute", "fixed", "sticky"].includes(style.position) ||
            style.transform !== "none" ||
            style.perspective !== "none"
        ) {
            return parent;
        }
        parent = parent.parentElement;
    }
    return document.documentElement;
};

function _isCreatingStackingContext(computedStyle) {
    var position = computedStyle.position;
    var zIndexStr = computedStyle.zIndex;

    return (
        (position !== "static" && zIndexStr !== "auto") ||
        parseFloat(computedStyle.opacity) < 1 ||
        computedStyle.transform !== "none" ||
        computedStyle.filter !== "none" ||
        computedStyle.perspective !== "none" ||
        position === "fixed" ||
        position === "sticky"
    );
}

function _getStackingContextRoot(element) {
    var curr = element.parentElement;
    while (curr && curr !== document.documentElement) {
        var style = lib.getComputedStyle(curr);

        var createsStackingContext = _isCreatingStackingContext(style);

        if (createsStackingContext) {
            return curr;
        }
        curr = curr.parentElement;
    }

    return document.documentElement;
}

function _getEffectiveZIndex(element) {
    var curr = element;
    while (curr && curr !== document.documentElement) {
        var style = lib.getComputedStyle(curr);
        var zIndexStr = style.zIndex;
        var createsStackingContext = _isCreatingStackingContext(style);

        if (zIndexStr !== "auto") {
            var num = parseFloat(zIndexStr);

            return isNaN(num) ? 0 : num;
        }

        if (createsStackingContext) {
            // z-index is auto but this is the root of current stacking context, so treat as 0
            return 0;
        }

        curr = curr.parentElement;
    }

    return 0;
}

exports.buildZChain = function buildZChain(element) {
    var chain = [];
    var curr = element;

    while (curr && curr !== document.documentElement) {
        var ctx = _getStackingContextRoot(curr);
        var z = _getEffectiveZIndex(curr);

        chain.unshift({ ctx: ctx, z: z });

        if (ctx === document.documentElement) {
            break;
        }
        curr = ctx;
    }

    return chain;
};

exports.isChainBehind = function isChainBehind(candChain, targetChain) {
    // Algorithm:
    // 1. Find the closest common stacking context between two chains
    // 2. Compare z-indices of elements in the common stacking context
    // If there's no common stacking context, we can't be sure, so treat as overlapping
    for (var j = targetChain.length - 1; j >= 0; j--) {
        for (var i = candChain.length - 1; i >= 0; i--) {
            if (candChain[i].ctx === targetChain[j].ctx) {
                return candChain[i].z < targetChain[j].z;
            }
        }
    }

    return false;
};
