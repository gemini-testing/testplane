"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
exports.__esModule = true;
exports.matchMedia = exports.getComputedStyle = exports.trim = exports.queryAll = exports.queryFirst = void 0;
/*jshint newcap:false*/
var sizzle_1 = __importDefault(require("sizzle"));
var xpath = __importStar(require("./xpath"));
function queryFirst(selector) {
    if (xpath.isXpathSelector(selector)) {
        return xpath.queryFirst(selector);
    }
    var elems = (0, sizzle_1["default"])(trim(selector) + ':first');
    return elems.length > 0 ? elems[0] : null;
}
exports.queryFirst = queryFirst;
function queryAll(selector) {
    if (xpath.isXpathSelector(selector)) {
        return xpath.queryAll(selector);
    }
    return (0, sizzle_1["default"])(selector);
}
exports.queryAll = queryAll;
function trim(str) {
    // trim spaces, unicode BOM and NBSP and the beginning and the end of the line
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/Trim#Polyfill
    return str.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
}
exports.trim = trim;
var getComputedStyle_1 = require("./polyfills/getComputedStyle");
__createBinding(exports, getComputedStyle_1, "getComputedStyle");
var matchMedia_1 = require("./polyfills/matchMedia");
__createBinding(exports, matchMedia_1, "matchMedia");
