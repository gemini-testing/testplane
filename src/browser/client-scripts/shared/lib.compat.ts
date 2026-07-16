/// <reference types="./sizzle" />
import Sizzle from "sizzle";
import * as xpath from "./xpath";

export type ElementTarget = string | Element;

export function queryFirst(target: ElementTarget): Element | null {
    if (typeof target !== "string") {
        return target;
    }
    if (xpath.isXpathSelector(target)) {
        return xpath.queryFirst(target);
    }
    const elems = Sizzle(trim(target) + ":first");
    return elems.length > 0 ? elems[0] : null;
}

export function queryAll(target: ElementTarget): Element[] {
    if (typeof target !== "string") {
        return [target];
    }
    if (xpath.isXpathSelector(target)) {
        return xpath.queryAll(target);
    }
    return Sizzle(target);
}

export function trim(str: string): string {
    // trim spaces, unicode BOM and NBSP and the beginning and the end of the line
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/Trim#Polyfill
    return str.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
}

export function getRootNode(node: Node): Node {
    let root = node;

    while (root.parentNode) {
        root = root.parentNode;
    }

    return root;
}

export { getComputedStyle } from "./polyfills/getComputedStyle";
export { matchMedia } from "./polyfills/matchMedia";
