/*jshint newcap:false*/
import Sizzle from 'sizzle';

import * as xpath from './xpath';

export function queryFirst(selector: string): Node | null {
    if (xpath.isXpathSelector(selector)) {
        return xpath.queryFirst(selector);
    }

    const elems = Sizzle(trim(selector) + ':first');

    return elems.length > 0 ? elems[0] : null;
}

export function queryAll(selector: string): Array<Node> {
    if (xpath.isXpathSelector(selector)) {
        return xpath.queryAll(selector);
    }

    return Sizzle(selector);
}

export function trim(str: string): string {
    // trim spaces, unicode BOM and NBSP and the beginning and the end of the line
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/Trim#Polyfill
    return str.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
}

export {getComputedStyle} from './polyfills/getComputedStyle';
export {matchMedia} from './polyfills/matchMedia';
