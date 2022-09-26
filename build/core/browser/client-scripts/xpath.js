"use strict";
exports.__esModule = true;
exports.queryAll = exports.queryFirst = exports.isXpathSelector = void 0;
var XPATH_SELECTORS_START = [
    '/', '(', '../', './', '*/'
];
function isXpathSelector(selector) {
    return XPATH_SELECTORS_START.some(function (startString) {
        return selector.indexOf(startString) === 0;
    });
}
exports.isXpathSelector = isXpathSelector;
function queryFirst(selector) {
    return document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}
exports.queryFirst = queryFirst;
function queryAll(selector) {
    var elements = document.evaluate(selector, document, null, XPathResult.ANY_TYPE, null);
    var nodes = [];
    var node = elements.iterateNext();
    while (node) {
        nodes.push(node);
        node = elements.iterateNext();
    }
    return nodes;
}
exports.queryAll = queryAll;
