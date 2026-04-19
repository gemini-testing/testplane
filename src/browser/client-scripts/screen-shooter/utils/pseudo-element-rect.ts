import { Rect, Coord, Length } from "@isomorphic";

interface TransformMatrix {
    a: number;
    b: number;
    c: number;
    d: number;
    tx: number;
    ty: number;
}

export type PseudoElementSelector = "::before" | "::after";

export const PSEUDO_ELEMENTS: PseudoElementSelector[] = ["::before", "::after"];

const PSEUDO_SELECTOR_REGEXP = /(.*?)(::before|::after)\s*$/i;

interface ParsedCaptureSelector {
    elementSelector: string;
    pseudoElement: PseudoElementSelector | null;
}

export function parseCaptureSelector(selector: string): ParsedCaptureSelector {
    const match = selector.match(PSEUDO_SELECTOR_REGEXP);

    if (!match) {
        return { elementSelector: selector, pseudoElement: null };
    }

    const elementSelector = match[1].trim();

    if (!elementSelector) {
        return { elementSelector: selector, pseudoElement: null };
    }

    return {
        elementSelector,
        pseudoElement: match[2].toLowerCase() as PseudoElementSelector
    };
}

function getElementBorderWidths(element: Element): { top: number; left: number } {
    const style = getComputedStyle(element);

    return {
        top: parseFloat(style.borderTopWidth),
        left: parseFloat(style.borderLeftWidth)
    };
}

function parseLengthOrZero(value: string): number {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
}

function getElementContentBottom(element: Element): number | null {
    const range = document.createRange();

    try {
        range.selectNodeContents(element);
        const rects = range.getClientRects();
        let bottom = -Infinity;

        for (let i = 0; i < rects.length; i++) {
            const rect = rects[i];
            if (rect.width < 0.0001 && rect.height < 0.0001) {
                continue;
            }
            bottom = Math.max(bottom, rect.bottom);
        }

        return bottom !== -Infinity ? bottom : null;
    } catch {
        return null;
    } finally {
        if (typeof range.detach === "function") {
            range.detach();
        }
    }
}

function getContainingBlockPaddingEdge(element: Element): { top: number; left: number } | null {
    let current: Element | null = element.parentElement;

    while (current) {
        const pos = getComputedStyle(current).position;
        if (pos !== "static") {
            const bcr = current.getBoundingClientRect();
            const borders = getElementBorderWidths(current);
            return {
                top: bcr.top + borders.top,
                left: bcr.left + borders.left
            };
        }
        current = current.parentElement;
    }

    return null; // initial containing block = viewport
}

function parseTransformMatrix(transform: string): TransformMatrix | null {
    if (!transform || transform === "none") return null;

    const match2d = transform.match(/matrix\(([^)]+)\)/);
    if (match2d) {
        const v = match2d[1].split(",").map(s => parseFloat(s.trim()));
        return { a: v[0], b: v[1], c: v[2], d: v[3], tx: v[4], ty: v[5] };
    }

    const match3d = transform.match(/matrix3d\(([^)]+)\)/);
    if (match3d) {
        const v = match3d[1].split(",").map(s => parseFloat(s.trim()));
        return { a: v[0], b: v[1], c: v[4], d: v[5], tx: v[12], ty: v[13] };
    }

    return null;
}

function resolveTransformOrigin(originStr: string, width: number, height: number): { x: number; y: number } {
    const parts = originStr.split(/\s+/);

    function resolve(val: string, size: number): number {
        if (val.slice(-1) === "%") {
            return (parseFloat(val) / 100) * size;
        }
        return parseFloat(val) || 0;
    }

    return {
        x: resolve(parts[0], width),
        y: resolve(parts[1] || parts[0], height)
    };
}

function applyTransformToRect(rect: Rect<"viewport", "css">, css: CSSStyleDeclaration): Rect<"viewport", "css"> {
    const matrix = parseTransformMatrix(css.transform);
    if (!matrix) return rect;

    const transformOrigin = resolveTransformOrigin(css.transformOrigin, rect.width, rect.height);
    const originX = rect.left + transformOrigin.x;
    const originY = rect.top + transformOrigin.y;

    const corners = [
        [rect.left, rect.top],
        [rect.left + rect.width, rect.top],
        [rect.left, rect.top + rect.height],
        [rect.left + rect.width, rect.top + rect.height]
    ];

    let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
    for (const [cornerX, cornerY] of corners) {
        const relativeX = cornerX - originX,
            relativeY = cornerY - originY;
        const transformedX = matrix.a * relativeX + matrix.c * relativeY + matrix.tx + originX;
        const transformedY = matrix.b * relativeX + matrix.d * relativeY + matrix.ty + originY;
        minX = Math.min(minX, transformedX);
        maxX = Math.max(maxX, transformedX);
        minY = Math.min(minY, transformedY);
        maxY = Math.max(maxY, transformedY);
    }

    return {
        left: minX as Coord<"viewport", "css", "x">,
        top: minY as Coord<"viewport", "css", "y">,
        width: (maxX - minX) as Length<"css", "x">,
        height: (maxY - minY) as Length<"css", "y">
    };
}

function computeBaseRect(
    element: Element,
    pseudo: PseudoElementSelector,
    css: CSSStyleDeclaration,
    elementRect: Rect<"viewport", "css">
): Rect<"viewport", "css"> | null {
    const width = parseFloat(css.width);
    const height = parseFloat(css.height);

    if (isNaN(width) || isNaN(height) || width < 0.0001 || height < 0.0001) {
        return null;
    }

    const position = css.position;

    if (position === "fixed") {
        const top = parseFloat(css.top);
        const left = parseFloat(css.left);

        return {
            top: (isNaN(top) ? 0 : top) as Coord<"viewport", "css", "y">,
            left: (isNaN(left) ? 0 : left) as Coord<"viewport", "css", "x">,
            width: width as Length<"css", "x">,
            height: height as Length<"css", "y">
        };
    }

    if (position === "absolute") {
        const elementCss = getComputedStyle(element);
        let originTop: number;
        let originLeft: number;

        if (elementCss.position !== "static") {
            const borders = getElementBorderWidths(element);
            originTop = (elementRect.top as number) + borders.top;
            originLeft = (elementRect.left as number) + borders.left;
        } else {
            const containingBlock = getContainingBlockPaddingEdge(element);
            originTop = containingBlock ? containingBlock.top : 0;
            originLeft = containingBlock ? containingBlock.left : 0;
        }

        const top = parseFloat(css.top);
        const left = parseFloat(css.left);

        return {
            top: (originTop + (isNaN(top) ? 0 : top)) as Coord<"viewport", "css", "y">,
            left: (originLeft + (isNaN(left) ? 0 : left)) as Coord<"viewport", "css", "x">,
            width: width as Length<"css", "x">,
            height: height as Length<"css", "y">
        };
    }

    const elementCss = getComputedStyle(element);
    const borderTop = parseLengthOrZero(elementCss.borderTopWidth);
    const borderLeft = parseLengthOrZero(elementCss.borderLeftWidth);
    const paddingTop = parseLengthOrZero(elementCss.paddingTop);
    const paddingLeft = parseLengthOrZero(elementCss.paddingLeft);
    const marginTop = parseLengthOrZero(css.marginTop);
    const marginLeft = parseLengthOrZero(css.marginLeft);
    const relativeTop = position === "relative" ? parseLengthOrZero(css.top) : 0;
    const relativeLeft = position === "relative" ? parseLengthOrZero(css.left) : 0;
    let flowTop = (elementRect.top as number) + borderTop + paddingTop;

    if (pseudo === "::after" && css.display === "block") {
        const contentBottom = getElementContentBottom(element);
        if (contentBottom !== null) {
            flowTop = Math.max(flowTop, contentBottom);
        }
    }

    // In-flow pseudo-element: anchor at the element content box and apply pseudo margins
    return {
        top: (flowTop + marginTop + relativeTop) as Coord<"viewport", "css", "y">,
        left: ((elementRect.left as number) + borderLeft + paddingLeft + marginLeft + relativeLeft) as Coord<
            "viewport",
            "css",
            "x"
        >,
        width: width as Length<"css", "x">,
        height: height as Length<"css", "y">
    };
}

export function getPseudoElementRect(
    element: Element,
    pseudo: "::before" | "::after",
    elementRect: Rect<"viewport", "css">
): Rect<"viewport", "css"> | null {
    const css = getComputedStyle(element, pseudo);

    if (css.content === "none" || css.display === "none" || css.visibility === "hidden") {
        return null;
    }

    const baseRect = computeBaseRect(element, pseudo, css, elementRect);
    if (!baseRect) return null;

    return applyTransformToRect(baseRect, css);
}
