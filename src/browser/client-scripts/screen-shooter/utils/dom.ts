import { ScreenshooterNamespaceData } from "../types";

declare global {
    // eslint-disable-next-line no-var
    var __geminiCore: Record<string, unknown> | undefined;
    // eslint-disable-next-line no-var
    var __geminiNamespace: string;
}

const FALLBACK_SCREENSHOOTER_NAMESPACE = "__testplane_screenshooter__";

export function getOwnerWindow(node: Node): Window | null {
    if (!node.ownerDocument) {
        return null;
    }
    return node.ownerDocument.defaultView;
}

export function getOwnerIframe(node: Node): Element | null {
    const nodeWindow = getOwnerWindow(node);
    if (nodeWindow) {
        return nodeWindow.frameElement;
    }
    return null;
}

export function getMainDocumentElem(currDocumentElem?: HTMLElement): HTMLElement {
    if (!currDocumentElem) {
        currDocumentElem = document.documentElement;
    }

    const currIframe = getOwnerIframe(currDocumentElem);
    if (!currIframe) {
        return currDocumentElem;
    }

    const currWindow = getOwnerWindow(currIframe);
    if (!currWindow) {
        return currDocumentElem;
    }

    return getMainDocumentElem(currWindow.document.documentElement);
}

export function forEachRoot(cb: (root: Element | ShadowRoot) => void): void {
    function traverseRoots(root: Element | ShadowRoot): void {
        cb(root);
        // @ts-expect-error - IE11 requires the third and fourth arguments
        const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);
        for (let node: Node | null = treeWalker.currentNode; node !== null; node = treeWalker.nextNode()) {
            if (node instanceof Element && node.shadowRoot) {
                traverseRoots(node.shadowRoot);
            }
        }
    }
    traverseRoots(document.documentElement);
}

export function getParentElement(node: Node): Element | null {
    if (node instanceof ShadowRoot) return node.host;
    if (node instanceof Element) {
        const root = node.getRootNode();
        return node.parentElement || (root instanceof ShadowRoot ? root.host : null);
    }
    return node.parentNode instanceof Element ? node.parentNode : null;
}

export function findFixedPositionedParent(element: Element): Element | null {
    let parent = element.parentElement;
    while (parent) {
        if (getComputedStyle(parent).position === "fixed") {
            return parent;
        }
        parent = parent.parentElement;
    }
    return null;
}

export function findContainingBlock(element: Element): Element {
    let parent = element.parentElement;
    while (parent) {
        const style = getComputedStyle(parent);
        if (
            style.position === "relative" ||
            style.position === "absolute" ||
            style.position === "fixed" ||
            style.position === "sticky" ||
            style.transform !== "none" ||
            style.perspective !== "none"
        ) {
            return parent;
        }
        parent = parent.parentElement;
    }
    return document.documentElement;
}

export function getScreenshooterNamespaceData(): ScreenshooterNamespaceData {
    if (!window.__geminiCore) {
        window.__geminiCore = {};
    }

    const namespace =
        typeof __geminiNamespace === "string" && __geminiNamespace
            ? __geminiNamespace
            : FALLBACK_SCREENSHOOTER_NAMESPACE;

    if (!window.__geminiCore[namespace]) {
        window.__geminiCore[namespace] = {};
    }

    return window.__geminiCore[namespace] as ScreenshooterNamespaceData;
}
