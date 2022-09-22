import * as util from './util';
import * as coverageLevel from '../../coverage/coverage-level';
import Rect, {getAbsoluteClientRect} from './rect';

import type * as libTyping from './lib.native';
import type {CoverageError, CoverageByUrl, Coverage} from '../../types/coverage';

const lib: typeof libTyping = require('./lib');

type Context = {
    media: number;
    href: string;
    coverage: Coverage;
};

export function collectCoverage(rect: Rect): Coverage {
    const coverage: Coverage = {};
    const sheets = document.styleSheets;

    for (let i = 0; i < sheets.length; i++) {
        const href = sheets[i].href as string;
        const rules = getRules(sheets[i]);

        if (isSecurityError(rules)) {
            coverage[href] = rules;
            continue;
        }

        const ctx: Context = {
            // media rule counter
            // coverage for media rules is stored by its index within stylesheet
            media: -1,
            href: href,
            coverage: coverage
        };

        for (let r = 0; r < rules.length; r++) {
            coverageForRule(rules[r], rect, ctx);
        }
    }

    return coverage;
}

function isSecurityError(rule: CSSRuleList | CoverageError): rule is CoverageError {
    return (rule as CoverageError).ignored;
}

function getRules(styleSheet: CSSStyleSheet): CSSRuleList | CoverageError {
    try {
        return styleSheet.cssRules || styleSheet.rules;
    } catch (e: unknown) {
        if (e instanceof Error && e.name === 'SecurityError') {
            return {
                ignored: true,
                message: 'Unable to read stylesheet rules due to the same origin policy'
            };
        }
        throw e;
    }
}

function coverageForRule(rule: CSSRule, area: Rect, ctx: Context): void {
    if (rule instanceof CSSConditionRule || rule instanceof CSSImportRule) {
        if (rule instanceof CSSConditionRule) {
            ctx.media++;

            if (!lib.matchMedia(rule.conditionText).matches) {
                return;
            }
        }

        const rules = (rule as CSSConditionRule).cssRules || (rule as CSSImportRule).styleSheet.cssRules;

        for (let r = 0; r < rules.length; r++) {
            coverageForRule(rules[r], area, ctx);
        }

        return;
    }

    if (!(rule instanceof CSSStyleRule)) {
        return;
    }

    util.each(rule.selectorText.split(','), function(selector) {
        selector = lib.trim(selector);
        let coverage = coverageLevel.NONE,
            matches = lib.queryAll(selector);

        const re = /:{1,2}(?:after|before|first-letter|first-line|selection)(:{1,2}\w+)?$/;

        // if selector contains pseudo-elements cut it off and try to find element without it
        if (matches.length === 0 && re.test(selector)) {
            const newSelector = lib.trim(selector.replace(re, '$1'));

            if (newSelector.length > 0) {
                matches = lib.queryAll(newSelector);
            }
        }

        if (matches.length > 0) {
            for (let match = 0; match < matches.length; match++) {
                const newCoverage = coverageForElem(matches[match] as Element, area);

                coverage = coverageLevel.merge(coverage, newCoverage);
            }
        }

        const byURL = ctx.coverage[ctx.href] = ctx.coverage[ctx.href] as CoverageByUrl || {};

        if (rule.parentRule && rule.parentRule instanceof CSSConditionRule) {
            selector = '?' + ctx.media + ':' + selector;
        }

        byURL[selector] = coverageLevel.merge(byURL[selector], coverage);
    });
}

function coverageForElem(elem: Element, captureRect: Rect): coverageLevel.CoverageValue {
    const elemRect = getAbsoluteClientRect(elem);

    if (captureRect.rectInside(elemRect)) {
        return coverageLevel.FULL;
    } else if (captureRect.rectIntersects(elemRect)) {
        return coverageLevel.PARTIAL;
    }

    return coverageLevel.NONE;
}
