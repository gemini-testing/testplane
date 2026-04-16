export function getReadableElementDescriptor(element: Element): string {
    if (element === document.documentElement) return "html";

    const tag = element.tagName.toLowerCase();

    if (element.id) return `${tag}#${element.id}`;

    if (element.classList.length) {
        const classes: string[] = [];

        for (let i = 0; i < element.classList.length; i++) {
            classes.push(element.classList[i]);
        }

        return tag + "." + classes.join(".");
    }

    return tag;
}
