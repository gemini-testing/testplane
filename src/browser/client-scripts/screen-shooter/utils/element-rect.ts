import { Rect, Coord, Length, getCoveringRect } from "@isomorphic";
import { getOwnerWindow, getOwnerIframe } from "./dom";
import { PSEUDO_ELEMENTS, PseudoElementSelector, getPseudoElementRect } from "./pseudo-element-rect";

interface BoxShadow {
    offsetX: number;
    offsetY: number;
    blurRadius: number;
    spreadRadius: number;
    inset: boolean;
}

export function domRectToViewportCss(domRect: DOMRect): Rect<"viewport", "css"> {
    return {
        top: domRect.top as Coord<"viewport", "css", "y">,
        left: domRect.left as Coord<"viewport", "css", "x">,
        width: domRect.width as Length<"css", "x">,
        height: domRect.height as Length<"css", "y">
    };
}

function getElementBorderWidths(element: Element): { top: number; left: number } {
    const ownerWindow = getOwnerWindow(element) || window;
    const style = ownerWindow.getComputedStyle(element);

    return {
        top: parseFloat(style.borderTopWidth),
        left: parseFloat(style.borderLeftWidth)
    };
}

function getIframeContentOrigin(node: Element): Rect<"viewport", "css"> {
    const border = getElementBorderWidths(node);
    const bcr = node.getBoundingClientRect();

    return {
        top: (bcr.top + border.top) as Coord<"viewport", "css", "y">,
        left: (bcr.left + border.left) as Coord<"viewport", "css", "x">,
        width: bcr.width as Length<"css", "x">,
        height: bcr.height as Length<"css", "y">
    };
}

function getNestedBoundingClientRect(node: Element, logger?: (...args: unknown[]) => unknown): Rect<"viewport", "css"> {
    const ownerIframe = getOwnerIframe(node);

    if (ownerIframe === null || getOwnerWindow(ownerIframe) === window) {
        logger?.("getNestedBoundingClientRect ownerIframe is null or window, returning bounding rect untouched");
        return domRectToViewportCss(node.getBoundingClientRect());
    }

    logger?.(
        "getNestedBoundingClientRect ownerIframe is not null or window, returning bounding rect with iframe origin"
    );

    const elementRect = domRectToViewportCss(node.getBoundingClientRect());
    let top = elementRect.top as number;
    let left = elementRect.left as number;

    let currentIframe: Element | null = ownerIframe;
    while (currentIframe) {
        const iframeOrigin = getIframeContentOrigin(currentIframe);
        top += iframeOrigin.top as number;
        left += iframeOrigin.left as number;

        currentIframe = getOwnerIframe(currentIframe);
        if (currentIframe && getOwnerWindow(currentIframe) === window) {
            const outerOrigin = getIframeContentOrigin(currentIframe);
            top += outerOrigin.top as number;
            left += outerOrigin.left as number;
            break;
        }
    }

    return {
        top: top as Coord<"viewport", "css", "y">,
        left: left as Coord<"viewport", "css", "x">,
        width: elementRect.width,
        height: elementRect.height
    };
}

function parseBoxShadow(value: string): BoxShadow[] {
    const regex = /[-+]?\d*\.?\d+px/g;
    const results: BoxShadow[] = [];

    for (const part of (value || "").split(",")) {
        const match = part.match(regex);
        if (match) {
            results.push({
                offsetX: parseFloat(match[0]),
                offsetY: parseFloat(match[1]) || 0,
                blurRadius: parseFloat(match[2]) || 0,
                spreadRadius: parseFloat(match[3]) || 0,
                inset: part.indexOf("inset") !== -1
            });
        }
    }

    return results;
}

function calculateShadowExtent(shadows: BoxShadow[]): { top: number; left: number; right: number; bottom: number } {
    const result = { top: 0, left: 0, right: 0, bottom: 0 };

    for (const shadow of shadows) {
        if (shadow.inset) continue;
        const blurAndSpread = shadow.spreadRadius + shadow.blurRadius;
        result.left = Math.min(shadow.offsetX - blurAndSpread, result.left);
        result.right = Math.max(shadow.offsetX + blurAndSpread, result.right);
        result.top = Math.min(shadow.offsetY - blurAndSpread, result.top);
        result.bottom = Math.max(shadow.offsetY + blurAndSpread, result.bottom);
    }

    return result;
}

function calculateShadowRect(clientRect: Rect<"viewport", "css">, shadows: BoxShadow[]): Rect<"viewport", "css"> {
    const extent = calculateShadowExtent(shadows);

    return {
        left: ((clientRect.left as number) + extent.left) as Coord<"viewport", "css", "x">,
        top: ((clientRect.top as number) + extent.top) as Coord<"viewport", "css", "y">,
        width: ((clientRect.width as number) - extent.left + extent.right) as Length<"css", "x">,
        height: ((clientRect.height as number) - extent.top + extent.bottom) as Length<"css", "y">
    };
}

function calculateOutlineRect(clientRect: Rect<"viewport", "css">, outline: number): Rect<"viewport", "css"> {
    return {
        top: ((clientRect.top as number) - outline) as Coord<"viewport", "css", "y">,
        left: ((clientRect.left as number) - outline) as Coord<"viewport", "css", "x">,
        width: ((clientRect.width as number) + outline * 2) as Length<"css", "x">,
        height: ((clientRect.height as number) + outline * 2) as Length<"css", "y">
    };
}

export function getExtRect(css: CSSStyleDeclaration, clientRect: Rect<"viewport", "css">): Rect<"viewport", "css"> {
    const shadows = parseBoxShadow(css.boxShadow);
    const outlineWidth = parseInt(css.outlineWidth, 10);
    const outline = !isNaN(outlineWidth) && css.outlineStyle !== "none" ? outlineWidth : 0;

    return getCoveringRect([calculateShadowRect(clientRect, shadows), calculateOutlineRect(clientRect, outline)])!;
}

function isHidden(css: CSSStyleDeclaration, rect: Rect<"viewport", "css">): boolean {
    return (
        css.display === "none" ||
        css.visibility === "hidden" ||
        parseFloat(css.opacity) < 0.0001 ||
        rect.width < 0.0001 ||
        rect.height < 0.0001
    );
}

export function getBoundingClientContentRect(element: Element): Rect<"viewport", "css"> {
    const style = getComputedStyle(element);
    const bcr = element.getBoundingClientRect();
    const borderLeft = parseFloat(style.borderLeftWidth) || 0;
    const borderTop = parseFloat(style.borderTopWidth) || 0;
    const borderRight = parseFloat(style.borderRightWidth) || 0;
    const borderBottom = parseFloat(style.borderBottomWidth) || 0;

    return {
        left: (bcr.left + borderLeft) as Coord<"viewport", "css", "x">,
        top: (bcr.top + borderTop) as Coord<"viewport", "css", "y">,
        width: (bcr.width - borderLeft - borderRight) as Length<"css", "x">,
        height: (bcr.height - borderTop - borderBottom) as Length<"css", "y">
    };
}

export function getElementCaptureRect(
    element: Element,
    logger?: (...args: unknown[]) => unknown
): Rect<"viewport", "css"> | null {
    const css = getComputedStyle(element);
    const clientRect = getNestedBoundingClientRect(element, logger);
    logger?.("getElementCaptureRect clientRect:", clientRect);

    if (isHidden(css, clientRect)) {
        return null;
    }

    let elementRect = getExtRect(css, clientRect);

    for (const pseudoElement of PSEUDO_ELEMENTS) {
        const pseudoCss = getComputedStyle(element, pseudoElement);
        elementRect = getCoveringRect([elementRect, getExtRect(pseudoCss, clientRect)])!;
    }

    return elementRect;
}

export function getPseudoElementCaptureRect(
    element: Element,
    pseudo: PseudoElementSelector
): Rect<"viewport", "css"> | null {
    const css = getComputedStyle(element);
    const clientRect = getNestedBoundingClientRect(element);

    if (isHidden(css, clientRect)) {
        return null;
    }

    const pseudoRect = getPseudoElementRect(element, pseudo, clientRect);

    if (!pseudoRect) {
        return null;
    }

    return getExtRect(getComputedStyle(element, pseudo), pseudoRect);
}

function parseBorderRadius(value: string): number {
    const [first, second] = value.trim().split(/\s+/);
    const parsed = parseFloat(second ?? first);
    return isNaN(parsed) ? 0 : parsed;
}

export function getVerticalRadiusInsets(element: Element): { top: number; bottom: number } {
    const style = getComputedStyle(element);

    return {
        top: Math.max(parseBorderRadius(style.borderTopLeftRadius), parseBorderRadius(style.borderTopRightRadius)),
        bottom: Math.max(
            parseBorderRadius(style.borderBottomLeftRadius),
            parseBorderRadius(style.borderBottomRightRadius)
        )
    };
}
