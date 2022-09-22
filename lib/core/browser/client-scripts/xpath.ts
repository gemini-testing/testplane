const XPATH_SELECTORS_START = [
    '/', '(', '../', './', '*/'
] as const;

export function isXpathSelector(selector: string): boolean {
    return XPATH_SELECTORS_START.some(function(startString) {
        return selector.indexOf(startString) === 0;
    });
}

export function queryFirst(selector: string): Node | null {
    return document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

export function queryAll(selector: string): Node[] {
    const elements = document.evaluate(selector, document, null, XPathResult.ANY_TYPE, null);
    const nodes = ([] as Array<Node>);
    let node = elements.iterateNext();

    while (node) {
        nodes.push(node);
        node = elements.iterateNext();
    }

    return nodes;
}
