import { Rect, Coord, Length, getIntersection } from "@isomorphic";
import { getBoundingClientContentRect } from "./element-rect";
import { isRootLikeElement } from "./scroll";
import { findContainingBlock } from "./dom";
import { getReadableElementDescriptor } from "./descriptions";

function getViewportRect(): Rect<"viewport", "css"> {
    return {
        top: 0 as Coord<"viewport", "css", "y">,
        left: 0 as Coord<"viewport", "css", "x">,
        width: window.innerWidth as Length<"css", "x">,
        height: window.innerHeight as Length<"css", "y">
    };
}

function hasOverflowClipping(style: CSSStyleDeclaration): boolean {
    return style.overflow !== "visible" || style.overflowX !== "visible" || style.overflowY !== "visible";
}

type AbsoluteContainingBlock = {
    /** Absolute ancestor of element is the element itself or one of its parents that has position: absolute */
    absoluteAncestor: Element;
    /** Containing block of absoluteAncestor is an element relative to which it's positioned, e.g. parent having position: relative */
    containingBlock: Element;
};

function getAbsoluteContainingBlocks(element: Element): AbsoluteContainingBlock[] {
    const absoluteContainingBlocks: AbsoluteContainingBlock[] = [];
    let current: Element | null = element;

    while (current && !isRootLikeElement(current)) {
        const style = getComputedStyle(current);

        if (style.position === "absolute") {
            const containingBlock = findContainingBlock(current);
            absoluteContainingBlocks.push({ absoluteAncestor: current, containingBlock });
        }

        current = current.parentElement;
    }

    return absoluteContainingBlocks;
}

function getFixedAncestors(element: Element): Element[] {
    const fixedAncestors: Element[] = [];
    let current: Element | null = element;

    while (current && !isRootLikeElement(current)) {
        if (getComputedStyle(current).position === "fixed") {
            fixedAncestors.push(current);
        }

        current = current.parentElement;
    }

    return fixedAncestors;
}

/** Absolute-positioned descendants may escape clipping when their containing block is outside clippingElement */
function escapesOverflowClippingViaAbsoluteContainingBlocks(
    clippingElement: Element,
    absoluteContainingBlocks: AbsoluteContainingBlock[]
): boolean {
    return absoluteContainingBlocks.some(({ absoluteAncestor, containingBlock }) => {
        if (absoluteAncestor === clippingElement || !clippingElement.contains(absoluteAncestor)) {
            return false;
        }

        return containingBlock !== clippingElement && containingBlock.contains(clippingElement);
    });
}

/** Fixed-position descendants escape clipping of ancestors above the fixed ancestor */
function escapesOverflowClippingViaFixedAncestors(clippingElement: Element, fixedAncestors: Element[]): boolean {
    return fixedAncestors.some(
        fixedAncestor => fixedAncestor !== clippingElement && clippingElement.contains(fixedAncestor)
    );
}

/**
 * Computes the clip rect for an element by intersecting the content boxes
 * of all ancestor elements with overflow clipping, starting from the viewport.
 *
 * Elements with `position: fixed` are only clipped by the viewport,
 * since they are positioned relative to the viewport and escape all
 * ancestor overflow clipping.
 */
export function getClipRect(element: Element, logger?: (...args: unknown[]) => unknown): Rect<"viewport", "css"> {
    const viewportRect = getViewportRect();

    const absoluteContainingBlocks = getAbsoluteContainingBlocks(element);
    const fixedAncestors = getFixedAncestors(element);

    let clipRect: Rect<"viewport", "css"> = viewportRect;
    let current: Element | null = element.parentElement;

    while (current) {
        if (isRootLikeElement(current)) {
            break;
        }
        const style = getComputedStyle(current);

        if (hasOverflowClipping(style)) {
            const isEscapingCurrentOverflowClipping =
                escapesOverflowClippingViaAbsoluteContainingBlocks(current, absoluteContainingBlocks) ||
                escapesOverflowClippingViaFixedAncestors(current, fixedAncestors);
            if (isEscapingCurrentOverflowClipping) {
                current = current.parentElement;
                continue;
            }

            const contentBox = getBoundingClientContentRect(current);
            logger?.("intersecting with:", getReadableElementDescriptor(current), "contentBox:", contentBox);
            const intersection = getIntersection(clipRect, contentBox);

            if (!intersection) {
                logger?.("no intersection found for:", getReadableElementDescriptor(current));

                // Element is fully clipped — return zero-sized rect at clip origin
                return {
                    top: clipRect.top,
                    left: clipRect.left,
                    width: 0 as Length<"css", "x">,
                    height: 0 as Length<"css", "y">
                };
            }

            clipRect = intersection;
        }

        current = current.parentElement;
    }

    return clipRect;
}
