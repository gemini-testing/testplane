'use strict';
var xpath = require('./xpath');

exports.queryFirst = function(selector) {
    if (xpath.isXpathSelector(selector)) {
        return xpath.queryFirst(selector);
    }
    return document.querySelector(selector);
};

exports.queryAll = function(selector) {
    if (xpath.isXpathSelector(selector)) {
        return xpath.queryAll(selector);
    }
    return document.querySelectorAll(selector);
};

exports.getComputedStyle = function(element, pseudoElement) {
    return getComputedStyle(element, pseudoElement);
};

exports.matchMedia = function(mediaQuery) {
    return matchMedia(mediaQuery);
};

exports.trim = function(str) {
    return str.trim();
};
