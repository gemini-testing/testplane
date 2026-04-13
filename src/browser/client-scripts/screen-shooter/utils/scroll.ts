import { Coord } from "../../../isomorphic/geometry";
import { getParentElement } from "./dom";
import { isSafariMobile } from "./user-agent";

const PSEUDO_SELECTOR_REGEXP = /(.*?)(::before|::after)\s*$/i;

function getElementSelector(selector: string): string {
    const match = selector.match(PSEUDO_SELECTOR_REGEXP);

    if (!match) {
        return selector;
    }

    const elementSelector = match[1].trim();

    return elementSelector || selector;
}

function isScrollable(element: Element): boolean {
    const overflowY = getComputedStyle(element).overflowY;
    return (
        element.scrollHeight > element.clientHeight &&
        (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay")
    );
}

export function getScrollParent(element: Element): Element | null {
    if (getComputedStyle(element).position === "fixed") {
        return null;
    }

    let current = getParentElement(element);

    while (current && current !== document.documentElement) {
        if (isScrollable(current)) return current;
        if (getComputedStyle(current).position === "fixed") return null;
        current = getParentElement(current);
    }

    return current === document.documentElement ? document.documentElement : null;
}

export function getScrollParentsChain(element: Element): Element[] {
    const chain: Element[] = [];
    let parent = getScrollParent(element);

    while (parent && parent !== document.documentElement) {
        chain.unshift(parent);
        parent = getScrollParent(parent);
    }

    chain.unshift(document.documentElement);
    return chain;
}

export function getCommonScrollParent(selectors: string[]): Element {
    const elements = selectors
        .map(s => document.querySelector(getElementSelector(s)))
        .filter((e): e is NonNullable<typeof e> => e !== null);
    if (elements.length === 0) return document.documentElement;
    if (elements.length === 1) {
        const parent = getScrollParent(elements[0]);
        return parent ? normalizeRootLikeElement(parent) : document.documentElement;
    }

    const chains = elements.map(el => getScrollParentsChain(el));
    const minLength = Math.min(...chains.map(c => c.length));

    let common: Element = document.documentElement;
    for (let i = 0; i < minLength; i++) {
        if (chains.every(chain => chain[i] === chains[0][i])) {
            common = chains[0][i];
        } else {
            break;
        }
    }

    return normalizeRootLikeElement(common);
}

function getElementScrollTop(element: Element): number {
    return isRootLikeElement(element) ? window.scrollY : element.scrollTop;
}

const SCROLL_APPLY_MAX_WAIT_MS = 50;
const SCROLL_APPLY_MAX_ITERATIONS = 10000;

function getPageScrollElement(): Element {
    return document.scrollingElement ?? document.documentElement;
}

export function isRootLikeElement(element: Element): boolean {
    const pageScrollElement = getPageScrollElement();
    return element === document.documentElement || element === document.body || element === pageScrollElement;
}

function normalizeRootLikeElement(element: Element): Element {
    return isRootLikeElement(element) ? document.documentElement : element;
}

/**
 * iOS Safari has quirks when calling window.scrollTo near page top
 * @see https://gist.github.com/shadowusr/da03a7d66059c44baeb698db2d4e8658
 */
export function performScrollFixForSafariIfNeeded(targetY: number): void {
    if (!isSafariMobile()) {
        return;
    }
    if (window.scrollY < 100 && targetY < 100) {
        window.scrollTo(window.scrollX, 100);
    }
}

export function scrollElementBy(
    element: Element,
    deltaY: Coord<"page", "css", "y">,
    logger?: (...args: unknown[]) => unknown
): void {
    const delta = deltaY;
    const isRootLike = isRootLikeElement(element);
    const scrollMetricsElement = isRootLike ? getPageScrollElement() : element;
    const currentScrollY = isRootLike ? window.scrollY : element.scrollTop;

    // Clamping is needed due to a bug in safari - https://bugs.webkit.org/show_bug.cgi?id=179735
    const maxScrollY = scrollMetricsElement.scrollHeight - scrollMetricsElement.clientHeight;
    const targetY = Math.max(0, Math.min(currentScrollY + delta, maxScrollY));

    if (isRootLike) {
        logger?.("scrollElementBy: scrolling window.scrollTo(" + window.scrollX + ", " + targetY + ")");

        performScrollFixForSafariIfNeeded(targetY);
        window.scrollTo(window.scrollX, targetY);
    } else {
        logger?.("scrollElementBy: scrolling element.scrollTo(" + element.scrollLeft + ", " + targetY + ")");
        element.scrollTo(element.scrollLeft, targetY);
    }

    const startedAt = performance.now();
    let iterations = 0;
    while (performance.now() - startedAt < SCROLL_APPLY_MAX_WAIT_MS && iterations < SCROLL_APPLY_MAX_ITERATIONS) {
        if (getElementScrollTop(element) !== currentScrollY) {
            return;
        }
        iterations++;
    }
}

export function scrollElementToOffset(element: Element, offset: Coord<"page", "css", "y">): void {
    const isRootLike = isRootLikeElement(element);
    const scrollMetricsElement = isRootLike ? getPageScrollElement() : element;
    const currentScrollY = isRootLike ? window.scrollY : element.scrollTop;

    // Clamping is needed due to a bug in safari - https://bugs.webkit.org/show_bug.cgi?id=179735
    const maxScrollY = scrollMetricsElement.scrollHeight - scrollMetricsElement.clientHeight;
    const targetY = Math.max(0, Math.min(offset, maxScrollY));

    if (isRootLike) {
        performScrollFixForSafariIfNeeded(targetY);
        window.scrollTo(window.scrollX, targetY);
    } else {
        element.scrollTo(element.scrollLeft, targetY);
    }

    const startedAt = performance.now();
    let iterations = 0;
    while (performance.now() - startedAt < SCROLL_APPLY_MAX_WAIT_MS && iterations < SCROLL_APPLY_MAX_ITERATIONS) {
        if (getElementScrollTop(element) === currentScrollY) {
            return;
        }
        iterations++;
    }
}
