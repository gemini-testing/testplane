import * as xpath from './xpath';

export function queryFirst(selector: string): Node | null {
    if (xpath.isXpathSelector(selector)) {
        return xpath.queryFirst(selector);
    }

    return document.querySelector(selector);
}

export function queryAll(selector: string): Array<Node> | NodeListOf<Node> {
    if (xpath.isXpathSelector(selector)) {
        return xpath.queryAll(selector);
    }

    return document.querySelectorAll(selector);
}

export function getComputedStyle(element: Element, pseudoElement?: string): CSSStyleDeclaration {
    return window.getComputedStyle(element, pseudoElement);
}

export function matchMedia(mediaQuery: string): MediaQueryList {
    return window.matchMedia(mediaQuery);
}

export function trim(str: string): string {
    return str.trim();
}
