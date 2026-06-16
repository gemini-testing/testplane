import { getParentElement } from "./dom";

function getCssProp(style: CSSStyleDeclaration, prop: string): string | undefined {
    return (style as unknown as Record<string, string | undefined>)[prop];
}

function hasCssProp(style: CSSStyleDeclaration, prop: string, defaultValue = "none"): boolean {
    const value = getCssProp(style, prop);
    return value !== undefined && value !== defaultValue;
}

function isFlexContainer(style: CSSStyleDeclaration): boolean {
    return style.display === "flex" || style.display === "inline-flex";
}

function isGridContainer(style: CSSStyleDeclaration): boolean {
    return (style.display || "").indexOf("grid") !== -1;
}

function hasContainStackingContext(contain: string): boolean {
    return (
        contain === "layout" ||
        contain === "paint" ||
        contain === "strict" ||
        contain === "content" ||
        contain.indexOf("paint") !== -1 ||
        contain.indexOf("layout") !== -1
    );
}

function createsStackingContext(element: Element): boolean {
    const style = getComputedStyle(element);
    const position = style.position;
    const zIndex = style.zIndex;

    if (position === "fixed" || position === "sticky") return true;
    if (getCssProp(style, "containerType") === "size" || getCssProp(style, "containerType") === "inline-size")
        return true;
    if (zIndex !== "auto" && position !== "static") return true;
    if (parseFloat(style.opacity) < 1) return true;
    if (style.transform !== "none") return true;
    if (hasCssProp(style, "scale")) return true;
    if (hasCssProp(style, "rotate")) return true;
    if (hasCssProp(style, "translate")) return true;
    if (style.mixBlendMode !== "normal") return true;
    if (style.filter !== "none") return true;
    if (hasCssProp(style, "backdropFilter")) return true;
    if (hasCssProp(style, "webkitBackdropFilter")) return true;
    if (style.perspective !== "none") return true;
    if (hasCssProp(style, "clipPath")) return true;

    const mask = getCssProp(style, "mask") || getCssProp(style, "webkitMask");
    if (mask !== undefined && mask !== "none") return true;

    const maskImage = getCssProp(style, "maskImage") || getCssProp(style, "webkitMaskImage");
    if (maskImage !== undefined && maskImage !== "none") return true;

    const maskBorder = getCssProp(style, "maskBorder") || getCssProp(style, "webkitMaskBorder");
    if (maskBorder !== undefined && maskBorder !== "none") return true;

    if (style.isolation === "isolate") return true;

    const willChange = style.willChange || "";
    if (willChange.indexOf("transform") !== -1 || willChange.indexOf("opacity") !== -1) return true;

    if (getCssProp(style, "webkitOverflowScrolling") === "touch") return true;

    if (zIndex !== "auto") {
        const parent = getParentElement(element);
        if (parent) {
            const parentStyle = getComputedStyle(parent);
            if (isFlexContainer(parentStyle) || isGridContainer(parentStyle)) return true;
        }
    }

    if (hasContainStackingContext(style.contain || "")) return true;

    return false;
}

function getClosestStackingContext(node: Node | null): Element {
    if (!node || node === document.documentElement) {
        return document.documentElement;
    }

    if (node instanceof ShadowRoot) {
        return getClosestStackingContext(node.host);
    }

    if (!(node instanceof Element)) {
        return getClosestStackingContext(node.parentNode);
    }

    if (createsStackingContext(node)) {
        return node;
    }

    return getClosestStackingContext(getParentElement(node));
}

function getStackingContextRoot(element: Element): Element {
    return getClosestStackingContext(getParentElement(element));
}

function getEffectiveZIndex(element: Element): number {
    let curr: Element | null = element;

    while (curr && curr !== document.documentElement) {
        const style = getComputedStyle(curr);

        if (style.zIndex !== "auto") {
            const num = parseFloat(style.zIndex);
            return isNaN(num) ? 0 : num;
        }

        if (createsStackingContext(curr)) {
            return 0;
        }

        curr = curr.parentElement;
    }

    return 0;
}

interface ZChainItem {
    ctx: Element;
    z: number;
}

export function buildZChain(element: Element): ZChainItem[] {
    const chain: ZChainItem[] = [];
    let curr: Element | null = element;

    while (curr && curr !== document.documentElement) {
        const ctx = getStackingContextRoot(curr);
        const z = getEffectiveZIndex(curr);

        chain.unshift({ ctx, z });

        if (ctx === document.documentElement) break;
        curr = ctx;
    }

    return chain;
}

export function isChainBehind(candChain: ZChainItem[], targetChain: ZChainItem[]): boolean {
    for (let j = targetChain.length - 1; j >= 0; j--) {
        for (let i = candChain.length - 1; i >= 0; i--) {
            if (candChain[i].ctx === targetChain[j].ctx) {
                return candChain[i].z < targetChain[j].z;
            }
        }
    }

    return false;
}
