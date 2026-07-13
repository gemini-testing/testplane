import * as xpath from "./xpath";

export type ElementTarget = string | Element;

export function queryFirst(target: ElementTarget): Element | null {
    if (typeof target !== "string") {
        return target;
    }
    if (xpath.isXpathSelector(target)) {
        return xpath.queryFirst(target);
    }
    return document.querySelector(target);
}

export function queryAll(target: ElementTarget): Element[] {
    if (typeof target !== "string") {
        return [target];
    }
    if (xpath.isXpathSelector(target)) {
        return xpath.queryAll(target);
    }
    return Array.from(document.querySelectorAll(target));
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

export function getRootNode(node: Node): Node {
    return node.getRootNode();
}
