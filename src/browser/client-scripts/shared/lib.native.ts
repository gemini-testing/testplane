import * as xpath from "./xpath";

export function queryFirst(selector: string): Element | null {
    if (xpath.isXpathSelector(selector)) {
        return xpath.queryFirst(selector);
    }
    return document.querySelector(selector);
}

export function queryAll(selector: string): Element[] {
    if (xpath.isXpathSelector(selector)) {
        return xpath.queryAll(selector);
    }
    return Array.from(document.querySelectorAll(selector));
}

export function getComputedStyle(element: Element, pseudoElement: string): CSSStyleDeclaration {
    return getComputedStyle(element, pseudoElement);
}

export function matchMedia(mediaQuery: string): MediaQueryList {
    return matchMedia(mediaQuery);
}

export function trim(str: string): string {
    return str.trim();
}
