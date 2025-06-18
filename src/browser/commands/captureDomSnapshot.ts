import type { Browser } from "../types";

export interface CaptureSnapshotOptions {
    includeTags?: string[];
    includeAttrs?: string[];
    excludeTags?: string[];
    excludeAttrs?: string[];
    truncateText?: boolean;
    maxTextLength?: number;
}

export interface CaptureSnapshotResult {
    snapshot: string;
    omittedTags: string[];
    omittedAttributes: string[];
    textWasTruncated: boolean;
}

export const captureDomSnapshotInBrowser = ({
    includeTags = [],
    includeAttrs = [],
    excludeTags = [],
    excludeAttrs = [],
    truncateText = true,
    maxTextLength = 100,
}: CaptureSnapshotOptions = {}): CaptureSnapshotResult => {
    const BASE_EXCLUDED_TAGS = new Set([
        "HEAD",
        "LINK",
        "META",
        "NOSCRIPT",
        "SCRIPT",
        "SLOT",
        "STYLE",
        "TEMPLATE",
        "TITLE",
    ]);

    const EXCLUDED_TAGS = new Set(BASE_EXCLUDED_TAGS);
    if (includeTags) {
        includeTags.forEach(tag => EXCLUDED_TAGS.delete(tag.toUpperCase()));
    }
    if (excludeTags) {
        excludeTags.forEach(tag => EXCLUDED_TAGS.add(tag.toUpperCase()));
    }

    const BASE_USEFUL_ATTRIBUTES = new Set([
        "action",
        "alt",
        "aria-describedby",
        "aria-label",
        "aria-labelledby",
        "checked",
        "class",
        "data-automation",
        "data-qa",
        "data-test",
        "data-test-id",
        "data-testid",
        "disabled",
        "for",
        "hidden",
        "href",
        "id",
        "method",
        "name",
        "open",
        "placeholder",
        "readonly",
        "required",
        "role",
        "selected",
        "src",
        "tabindex",
        "title",
        "type",
        "value",
    ]);

    const USEFUL_ATTRIBUTES = new Set(BASE_USEFUL_ATTRIBUTES);
    if (includeAttrs) {
        includeAttrs.forEach(attr => USEFUL_ATTRIBUTES.add(attr.toLowerCase()));
    }
    if (excludeAttrs) {
        excludeAttrs.forEach(attr => USEFUL_ATTRIBUTES.delete(attr.toLowerCase()));
    }

    const omittedTags = new Set<string>();
    const omittedAttributes = new Set<string>();
    let textWasTruncated = false;

    const INTERACTIVE_TAGS = new Set(["BUTTON", "INPUT", "SELECT", "TEXTAREA", "A"]);

    const INTERACTIVE_ROLES = new Set([
        "button",
        "checkbox",
        "combobox",
        "link",
        "listbox",
        "menu",
        "menubar",
        "menuitem",
        "menuitemcheckbox",
        "menuitemradio",
        "option",
        "radio",
        "radiogroup",
        "searchbox",
        "slider",
        "spinbutton",
        "switch",
        "tab",
        "tablist",
        "textbox",
        "tree",
        "treeitem",
    ]);

    const escapeQuotesAndNewlines = (value: string): string => {
        return value.replace(/"/g, '\\"').replace(/\n/g, "\\n");
    };

    function isElementVisible(element: Element): boolean {
        const style = window.getComputedStyle(element);

        // For SVG elements, check differently since they don't have offsetWidth/offsetHeight
        if (element.tagName.toLowerCase() === "svg" || element instanceof SVGElement) {
            return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
        }

        const htmlElement = element as HTMLElement;
        return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0" &&
            htmlElement.offsetWidth > 0 &&
            htmlElement.offsetHeight > 0
        );
    }

    function hasInteractiveContent(element: Element): boolean {
        if (INTERACTIVE_TAGS.has(element.tagName)) {
            return true;
        }

        if (
            element.hasAttribute("onclick") ||
            element.hasAttribute("tabindex") ||
            INTERACTIVE_ROLES.has(element.getAttribute("role") || "")
        ) {
            return true;
        }

        return Array.from(element.children).some(child => hasInteractiveContent(child));
    }

    function hasImportantOrTestAttributes(element: Element, importantAttributes: string[]): boolean {
        const testAttrs = ["data-testid", "data-test-id", "data-test", "data-qa", "data-automation"];

        return (
            importantAttributes.some(attr => element.hasAttribute(attr)) ||
            testAttrs.some(attr => element.hasAttribute(attr))
        );
    }

    function getElementText(element: Element): string {
        let text = "";
        for (const node of element.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                const textContent = node.textContent?.trim();
                if (textContent) {
                    text += textContent + " ";
                }
            }
        }
        text = text.trim();

        if (truncateText && text.length > maxTextLength) {
            textWasTruncated = true;
            text = text.substring(0, maxTextLength) + "...";
        }

        return text;
    }

    function getElementState(element: Element): Record<string, string | boolean> {
        const state: Record<string, string | boolean> = {};
        const tagName = element.tagName.toLowerCase();

        if (document.activeElement === element && element !== document.body) {
            state.focused = true;
        }

        try {
            const hoveredElements = Array.from(document.querySelectorAll(":hover"));
            const deepestHovered = hoveredElements[hoveredElements.length - 1];
            if (deepestHovered === element) {
                state.hover = true;
            }
        } catch {
            /* */
        }

        try {
            switch (tagName) {
                case "input": {
                    const inputEl = element as HTMLInputElement;
                    const inputType = inputEl.type.toLowerCase();

                    if (inputType === "checkbox" || inputType === "radio") {
                        if (inputEl.checked) {
                            state.checked = true;
                        }
                    } else if (inputEl.value) {
                        state.value = inputEl.value;
                    }

                    if (inputEl.checkValidity && !inputEl.checkValidity()) {
                        state.invalid = true;
                    }
                    break;
                }
                case "textarea": {
                    const textareaEl = element as HTMLTextAreaElement;

                    if (textareaEl.value) {
                        state.value = textareaEl.value;
                    }

                    if (textareaEl.checkValidity && !textareaEl.checkValidity()) {
                        state.invalid = true;
                    }
                    break;
                }
                case "select": {
                    const selectEl = element as HTMLSelectElement;
                    const selectedOption = selectEl.options[selectEl.selectedIndex];

                    if (selectedOption) {
                        state.selected = selectedOption.value;

                        if (selectedOption.text !== selectedOption.value) {
                            state.selectedText = selectedOption.text;
                        }
                    }
                    break;
                }
                case "option": {
                    const optionEl = element as HTMLOptionElement;

                    if (optionEl.selected) {
                        state.selected = true;
                    }
                    break;
                }
            }
        } catch {
            /* */
        }

        return state;
    }

    function buildElementNode(element: Element, depth: number = 0): string | null {
        const tagName = element.tagName.toLowerCase();

        if (EXCLUDED_TAGS.has(element.tagName)) {
            omittedTags.add(tagName);
            return null;
        }

        const hasTestAttrs = hasImportantOrTestAttributes(element, includeAttrs);

        const isVisible = isElementVisible(element);

        const directText = getElementText(element);

        const children: string[] = [];

        if (tagName !== "svg") {
            for (const child of element.children) {
                const childNode = buildElementNode(child, depth + 1);
                if (childNode) {
                    children.push(childNode);
                }
            }
        }

        const selfClosingTags = new Set(["img", "input", "br", "hr", "meta", "link"]);

        // Hide empty elements that doesn't have anything interesting
        if (children.length === 0 && !directText && !selfClosingTags.has(tagName)) {
            const hasInterestingContent = hasInteractiveContent(element) || hasTestAttrs;
            // SVGs need special handling, because we omit their children during filtering on our end
            // For SVGs, children.length is always zero, and we need to check real DOM (element.children)
            if (tagName === "svg") {
                if (element.children.length === 0 && !hasInterestingContent) {
                    return null;
                }
            } else if (!hasInteractiveContent(element) && !hasTestAttrs && !tagName.includes("-")) {
                return null;
            }
        }

        return buildCompactElement(element, directText, children, depth, !isVisible);
    }

    function buildCompactElement(
        element: Element,
        text: string | undefined,
        children: string[],
        depth: number,
        forceHidden: boolean = false,
    ): string {
        const tagName = element.tagName.toLowerCase();
        const indent = " ".repeat(depth);

        // Build CSS-like selector: tag.class#id
        let selector = tagName;

        const className = element.getAttribute("class");
        if (className && USEFUL_ATTRIBUTES.has("class")) {
            const classes = className.trim().split(/\s+/).filter(Boolean);
            if (classes.length > 0) {
                selector += "." + classes.join(".");
            }
        }

        const id = element.id;
        if (id && USEFUL_ATTRIBUTES.has("id")) {
            selector += "#" + id;
        }

        // Build compact attributes [key=val key2="val with spaces"]
        const attributes: string[] = [];

        for (const attr of element.attributes) {
            const attrName = attr.name.toLowerCase();

            if (attrName === "class" || attrName === "id") {
                continue;
            }

            if (USEFUL_ATTRIBUTES.has(attrName)) {
                let value = attr.value;
                if (value.length > maxTextLength) {
                    textWasTruncated = true;
                    value = value.substring(0, maxTextLength) + "...";
                }

                if ([" ", '"', "="].some(char => value.includes(char))) {
                    value = escapeQuotesAndNewlines(value);
                    attributes.push(`${attrName}="${value}"`);
                } else if (value === "") {
                    // Boolean attributes like 'required', 'disabled'
                    attributes.push(attrName);
                } else {
                    attributes.push(`${attrName}=${value}`);
                }
            } else {
                omittedAttributes.add(attrName);
            }
        }

        const elementState = getElementState(element);
        for (const [key, value] of Object.entries(elementState)) {
            if (typeof value === "boolean") {
                attributes.push(`@${key}`);
            } else {
                if (value.includes(" ") || value.includes('"')) {
                    const escapedValue = escapeQuotesAndNewlines(value);
                    attributes.push(`@${key}="${escapedValue}"`);
                } else {
                    attributes.push(`@${key}=${value}`);
                }
            }
        }

        if (forceHidden) {
            attributes.push("@hidden");
        }

        let elementLine = selector;

        if (attributes.length > 0) {
            elementLine += `[${attributes.join(" ")}]`;
        }

        if (text) {
            const escapedText = escapeQuotesAndNewlines(text);
            elementLine += ` "${escapedText}"`;
        }

        if (children.length > 0) {
            const childLines = children.join("\n");
            // If a line contains ": " string, we should place it in quotes and escape to be parsed correctly
            const escapedElementLine = elementLine.includes(": ")
                ? `"${elementLine.replace(/"/g, '\\"')}"`
                : elementLine;
            return `${indent}- ${escapedElementLine}:\n${childLines}`;
        } else {
            return indent + "- " + elementLine;
        }
    }

    const startElement = document.body || document.documentElement;
    if (!startElement) {
        return {
            snapshot: "# No elements found",
            omittedTags: [],
            omittedAttributes: [],
            textWasTruncated: false,
        };
    }

    const rootNode = buildElementNode(startElement);

    const compactSnapshot = rootNode ? `${rootNode}` : `# No visible elements found`;

    return {
        snapshot: compactSnapshot,
        omittedTags: Array.from(omittedTags).sort(),
        omittedAttributes: Array.from(omittedAttributes).sort(),
        textWasTruncated,
    };
};

export default (browser: Browser): void => {
    const { publicAPI: session } = browser;

    session.addCommand(
        "unstable_captureDomSnapshot",
        async function (options: Partial<CaptureSnapshotOptions> = {}): Promise<CaptureSnapshotResult> {
            return session.execute(captureDomSnapshotInBrowser, options);
        },
    );
};
