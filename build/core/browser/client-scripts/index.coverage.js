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
exports.collectCoverage = void 0;
var util = __importStar(require("./util"));
var coverageLevel = __importStar(require("../../coverage/coverage-level"));
var rect_1 = require("./rect");
var lib = require('./lib');
function collectCoverage(rect) {
    var coverage = {};
    var sheets = document.styleSheets;
    for (var i = 0; i < sheets.length; i++) {
        var href = sheets[i].href;
        var rules = getRules(sheets[i]);
        if (isSecurityError(rules)) {
            coverage[href] = rules;
            continue;
        }
        var ctx = {
            // media rule counter
            // coverage for media rules is stored by its index within stylesheet
            media: -1,
            href: href,
            coverage: coverage
        };
        for (var r = 0; r < rules.length; r++) {
            coverageForRule(rules[r], rect, ctx);
        }
    }
    return coverage;
}
exports.collectCoverage = collectCoverage;
function isSecurityError(rule) {
    return rule.ignored;
}
function getRules(styleSheet) {
    try {
        return styleSheet.cssRules || styleSheet.rules;
    }
    catch (e) {
        if (e instanceof Error && e.name === 'SecurityError') {
            return {
                ignored: true,
                message: 'Unable to read stylesheet rules due to the same origin policy'
            };
        }
        throw e;
    }
}
function coverageForRule(rule, area, ctx) {
    if (rule instanceof CSSConditionRule || rule instanceof CSSImportRule) {
        if (rule instanceof CSSConditionRule) {
            ctx.media++;
            if (!lib.matchMedia(rule.conditionText).matches) {
                return;
            }
        }
        var rules = rule.cssRules || rule.styleSheet.cssRules;
        for (var r = 0; r < rules.length; r++) {
            coverageForRule(rules[r], area, ctx);
        }
        return;
    }
    if (!(rule instanceof CSSStyleRule)) {
        return;
    }
    util.each(rule.selectorText.split(','), function (selector) {
        selector = lib.trim(selector);
        var coverage = coverageLevel.NONE, matches = lib.queryAll(selector);
        var re = /:{1,2}(?:after|before|first-letter|first-line|selection)(:{1,2}\w+)?$/;
        // if selector contains pseudo-elements cut it off and try to find element without it
        if (matches.length === 0 && re.test(selector)) {
            var newSelector = lib.trim(selector.replace(re, '$1'));
            if (newSelector.length > 0) {
                matches = lib.queryAll(newSelector);
            }
        }
        if (matches.length > 0) {
            for (var match = 0; match < matches.length; match++) {
                var newCoverage = coverageForElem(matches[match], area);
                coverage = coverageLevel.merge(coverage, newCoverage);
            }
        }
        var byURL = ctx.coverage[ctx.href] = ctx.coverage[ctx.href] || {};
        if (rule.parentRule && rule.parentRule instanceof CSSConditionRule) {
            selector = '?' + ctx.media + ':' + selector;
        }
        byURL[selector] = coverageLevel.merge(byURL[selector], coverage);
    });
}
function coverageForElem(elem, captureRect) {
    var elemRect = (0, rect_1.getAbsoluteClientRect)(elem);
    if (captureRect.rectInside(elemRect)) {
        return coverageLevel.FULL;
    }
    else if (captureRect.rectIntersects(elemRect)) {
        return coverageLevel.PARTIAL;
    }
    return coverageLevel.NONE;
}
