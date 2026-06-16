const XPATH_SELECTORS_START = ["/", "(", "../", "./", "*/"];

export function isXpathSelector(selector: string): boolean {
    return XPATH_SELECTORS_START.some(function (startString) {
        return selector.indexOf(startString) === 0;
    });
}

export function queryFirst(selector: string): Element | null {
    return document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
        .singleNodeValue as Element | null;
}

export function queryAll(selector: string): Element[] {
    const elements = document.evaluate(selector, document, null, XPathResult.ANY_TYPE, null);
    let node: Node | null;
    const nodes: Element[] = [];
    node = elements.iterateNext();

    while (node) {
        nodes.push(node as Element);
        node = elements.iterateNext();
    }

    return nodes;
}
