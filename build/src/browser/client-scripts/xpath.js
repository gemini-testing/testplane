"use strict";

var XPATH_SELECTORS_START = ["/", "(", "../", "./", "*/"];

function isXpathSelector(selector) {
    return XPATH_SELECTORS_START.some(function (startString) {
        return selector.indexOf(startString) === 0;
    });
}

function queryFirst(selector) {
    return document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

function queryAll(selector) {
    var elements = document.evaluate(selector, document, null, XPathResult.ANY_TYPE, null);
    var node,
        nodes = [];
    node = elements.iterateNext();
    while (node) {
        nodes.push(node);
        node = elements.iterateNext();
    }
    return nodes;
}

module.exports = {
    isXpathSelector: isXpathSelector,
    queryFirst: queryFirst,
    queryAll: queryAll
};
