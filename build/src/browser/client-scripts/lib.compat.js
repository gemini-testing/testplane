"use strict";
/*jshint newcap:false*/
var Sizzle = require("sizzle");
var xpath = require("./xpath");

exports.queryFirst = function (selector) {
    if (xpath.isXpathSelector(selector)) {
        return xpath.queryFirst(selector);
    }
    var elems = Sizzle(exports.trim(selector) + ":first");
    return elems.length > 0 ? elems[0] : null;
};

exports.queryAll = function (selector) {
    if (xpath.isXpathSelector(selector)) {
        return xpath.queryAll(selector);
    }
    return Sizzle(selector);
};

exports.trim = function (str) {
    // trim spaces, unicode BOM and NBSP and the beginning and the end of the line
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/Trim#Polyfill
    return str.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
};

exports.getComputedStyle = require("./polyfills/getComputedStyle").getComputedStyle;
exports.matchMedia = require("./polyfills/matchMedia").matchMedia;
