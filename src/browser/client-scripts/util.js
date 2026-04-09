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

function _matchesProp(style, propName, defaultValue) {
    if (typeof style[propName] === "undefined") {
        return false;
    }

    return style[propName] !== (typeof defaultValue === "undefined" ? "none" : defaultValue);
}

function _isFlexContainer(style) {
    return style.display === "flex" || style.display === "inline-flex";
}

function _isGridContainer(style) {
    return (style.display || "").indexOf("grid") !== -1;
}

function _hasContainStackingContext(contain) {
    if (!contain) {
        return false;
    }

    return (
        contain === "layout" ||
        contain === "paint" ||
        contain === "strict" ||
        contain === "content" ||
        contain.indexOf("paint") !== -1 ||
        contain.indexOf("layout") !== -1
    );
}

// This method was inspired by https://github.com/gwwar/z-context/blob/dea7c1c220c77281ce6a02b910460b3a5d4744c8/content-script.js#L30
function _stackingContextReason(node, computedStyle, includeReason) {
    var position = computedStyle.position;
    var zIndexStr = computedStyle.zIndex;
    var reasonValue = includeReason
        ? function (text) {
              return text;
          }
        : function () {
              return true;
          };

    if (position === "fixed" || position === "sticky") {
        return reasonValue("position: " + position);
    }

    if (computedStyle.containerType === "size" || computedStyle.containerType === "inline-size") {
        return reasonValue("container-type: " + computedStyle.containerType);
    }

    if (zIndexStr !== "auto" && position !== "static") {
        return reasonValue("position: " + position + "; z-index: " + zIndexStr);
    }

    if (parseFloat(computedStyle.opacity) < 1) {
        return reasonValue("opacity: " + computedStyle.opacity);
    }

    if (computedStyle.transform !== "none") {
        return reasonValue("transform: " + computedStyle.transform);
    }

    if (_matchesProp(computedStyle, "scale")) {
        return reasonValue("scale: " + computedStyle.scale);
    }

    if (_matchesProp(computedStyle, "rotate")) {
        return reasonValue("rotate: " + computedStyle.rotate);
    }

    if (_matchesProp(computedStyle, "translate")) {
        return reasonValue("translate: " + computedStyle.translate);
    }

    if (computedStyle.mixBlendMode !== "normal") {
        return reasonValue("mix-blend-mode: " + computedStyle.mixBlendMode);
    }

    if (computedStyle.filter !== "none") {
        return reasonValue("filter: " + computedStyle.filter);
    }

    if (_matchesProp(computedStyle, "backdropFilter")) {
        return reasonValue("backdrop-filter: " + computedStyle.backdropFilter);
    }

    if (_matchesProp(computedStyle, "webkitBackdropFilter")) {
        return reasonValue("-webkit-backdrop-filter: " + computedStyle.webkitBackdropFilter);
    }

    if (computedStyle.perspective !== "none") {
        return reasonValue("perspective: " + computedStyle.perspective);
    }

    if (_matchesProp(computedStyle, "clipPath")) {
        return reasonValue("clip-path: " + computedStyle.clipPath);
    }

    var mask = computedStyle.mask || computedStyle.webkitMask;
    if (typeof mask !== "undefined" && mask !== "none") {
        return reasonValue("mask: " + mask);
    }

    var maskImage = computedStyle.maskImage || computedStyle.webkitMaskImage;
    if (typeof maskImage !== "undefined" && maskImage !== "none") {
        return reasonValue("mask-image: " + maskImage);
    }

    var maskBorder = computedStyle.maskBorder || computedStyle.webkitMaskBorder;
    if (typeof maskBorder !== "undefined" && maskBorder !== "none") {
        return reasonValue("mask-border: " + maskBorder);
    }

    if (computedStyle.isolation === "isolate") {
        return reasonValue("isolation: isolate");
    }

    var willChange = computedStyle.willChange || "";
    if (willChange.indexOf("transform") !== -1 || willChange.indexOf("opacity") !== -1) {
        return reasonValue("will-change: " + willChange);
    }

    if (computedStyle.webkitOverflowScrolling === "touch") {
        return reasonValue("-webkit-overflow-scrolling: touch");
    }

    if (zIndexStr !== "auto") {
        var parentNode = getParentNode(node);
        if (parentNode instanceof Element) {
            var parentStyle = lib.getComputedStyle(parentNode);
            if (_isFlexContainer(parentStyle)) {
                return reasonValue("flex-item; z-index: " + zIndexStr);
            }
            if (_isGridContainer(parentStyle)) {
                return reasonValue("grid-item; z-index: " + zIndexStr);
            }
        }
    }

    if (_hasContainStackingContext(computedStyle.contain || "")) {
        return reasonValue("contain: " + computedStyle.contain);
    }

    return null;
}

function _createsStackingContext(node, computedStyle) {
    return Boolean(_stackingContextReason(node, computedStyle, false));
}

function _getClosestStackingContext(node, includeReason) {
    if (!node || node.nodeName === "HTML") {
        return includeReason ? { node: document.documentElement, reason: "root" } : document.documentElement;
    }

    if (node.nodeName === "#document-fragment") {
        return _getClosestStackingContext(node.host, includeReason);
    }

    if (!(node instanceof Element)) {
        return _getClosestStackingContext(getParentNode(node), includeReason);
    }

    var computedStyle = lib.getComputedStyle(node);
    var reason = _stackingContextReason(node, computedStyle, includeReason);

    if (reason) {
        return includeReason ? { node: node, reason: reason } : node;
    }

    return _getClosestStackingContext(getParentNode(node), includeReason);
}

function _getStackingContextRoot(element, includeReason) {
    return _getClosestStackingContext(getParentNode(element), includeReason);
}

function _getEffectiveZIndex(element) {
    var curr = element;
    while (curr && curr !== document.documentElement) {
        var style = lib.getComputedStyle(curr);
        var zIndexStr = style.zIndex;
        var createsStackingContext = _createsStackingContext(curr, style);

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

exports.buildZChain = function buildZChain(element, opts) {
    opts = opts || {};
    // includeReasons is useful for debugging only, but should not cause overhead in production
    var includeReasons = Boolean(opts.includeReasons);
    var chain = [];
    var curr = element;

    while (curr && curr !== document.documentElement) {
        var context = _getStackingContextRoot(curr, includeReasons);
        var ctx = includeReasons ? context.node : context;
        var z = _getEffectiveZIndex(curr);

        var chainItem = { ctx: ctx, z: z };
        if (includeReasons) {
            chainItem.reason = context.reason;
        }
        chain.unshift(chainItem);

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
