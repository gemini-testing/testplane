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
exports.__esModule = true;
exports.trim = exports.matchMedia = exports.getComputedStyle = exports.queryAll = exports.queryFirst = void 0;
var xpath = __importStar(require("./xpath"));
function queryFirst(selector) {
    if (xpath.isXpathSelector(selector)) {
        return xpath.queryFirst(selector);
    }
    return document.querySelector(selector);
}
exports.queryFirst = queryFirst;
function queryAll(selector) {
    if (xpath.isXpathSelector(selector)) {
        return xpath.queryAll(selector);
    }
    return document.querySelectorAll(selector);
}
exports.queryAll = queryAll;
function getComputedStyle(element, pseudoElement) {
    return window.getComputedStyle(element, pseudoElement);
}
exports.getComputedStyle = getComputedStyle;
function matchMedia(mediaQuery) {
    return window.matchMedia(mediaQuery);
}
exports.matchMedia = matchMedia;
function trim(str) {
    return str.trim();
}
exports.trim = trim;
