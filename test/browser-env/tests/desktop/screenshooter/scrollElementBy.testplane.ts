import { scrollElementBy } from "../../../../../src/browser/client-scripts/screen-shooter/utils/scroll";
import { Coord } from "../../../../../src/browser/isomorphic/geometry";

function query(selector: string): Element {
    const el = document.querySelector(selector);
    if (!el) {
        throw new Error(`Element not found: ${selector}`);
    }
    return el;
}

function getMaxScrollY(element: Element): number {
    return element.scrollHeight - element.clientHeight;
}

describe("scrollElementBy", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        document.body.style.cssText = "";
        window.scrollTo(0, 0);
    });

    describe("documentElement scroll", () => {
        it("should scroll root by floored delta value", async () => {
            const { default: html } = await import("./fixtures/scroll-element-by/layout.html?raw");
            document.body.innerHTML = html;

            scrollElementBy(document.documentElement, 120.9 as Coord<"page", "css", "y">);

            expect(window.scrollY).toBe(120);
        });

        it("should clamp root scroll at zero for large negative delta", async () => {
            const { default: html } = await import("./fixtures/scroll-element-by/layout.html?raw");
            document.body.innerHTML = html;
            window.scrollTo(0, 260);

            scrollElementBy(document.documentElement, -1000 as Coord<"page", "css", "y">);

            expect(window.scrollY).toBe(0);
        });

        it("should clamp root scroll at max for overshoot delta", async () => {
            const { default: html } = await import("./fixtures/scroll-element-by/layout.html?raw");
            document.body.innerHTML = html;

            const maxScrollY = getMaxScrollY(document.documentElement);
            window.scrollTo(0, maxScrollY - 5);

            scrollElementBy(document.documentElement, 500 as Coord<"page", "css", "y">);

            expect(window.scrollY).toBe(maxScrollY);
        });
    });

    describe("non-root element scroll", () => {
        it("should scroll container by floored delta and keeps horizontal scroll", async () => {
            const { default: html } = await import("./fixtures/scroll-element-by/layout.html?raw");
            document.body.innerHTML = html;

            const panel = query(".panel") as HTMLElement;
            panel.scrollTo(90, 100);

            scrollElementBy(panel, 40.8 as Coord<"page", "css", "y">);

            expect(panel.scrollTop).toBe(140);
            expect(panel.scrollLeft).toBe(90);
        });

        it("should clamp container scroll at zero", async () => {
            const { default: html } = await import("./fixtures/scroll-element-by/layout.html?raw");
            document.body.innerHTML = html;

            const panel = query(".panel") as HTMLElement;
            panel.scrollTop = 6;

            scrollElementBy(panel, -100 as Coord<"page", "css", "y">);

            expect(panel.scrollTop).toBe(0);
        });

        it("should clamp container scroll at max", async () => {
            const { default: html } = await import("./fixtures/scroll-element-by/layout.html?raw");
            document.body.innerHTML = html;

            const panel = query(".panel") as HTMLElement;
            const maxScrollY = getMaxScrollY(panel);
            panel.scrollTop = maxScrollY - 3;

            scrollElementBy(panel, 200 as Coord<"page", "css", "y">);

            expect(panel.scrollTop).toBe(maxScrollY);
        });

        it("should not move when floored delta is zero", async () => {
            const { default: html } = await import("./fixtures/scroll-element-by/layout.html?raw");
            document.body.innerHTML = html;

            const panel = query(".panel") as HTMLElement;
            panel.scrollTop = 42;

            scrollElementBy(panel, 0.99 as Coord<"page", "css", "y">);

            expect(panel.scrollTop).toBe(42);
        });
    });

    describe('"almost-root" element scroll', () => {
        it("should scroll page when body is passed as scroll element", async () => {
            const { default: html } = await import("./fixtures/scroll-element-by/layout.html?raw");
            document.body.innerHTML = html;
            window.scrollTo(0, 0);

            scrollElementBy(document.body, 120 as Coord<"page", "css", "y">);

            expect(window.scrollY).toBeGreaterThan(0);
        });

        it("should scroll page when html is passed as scroll element", async () => {
            const { default: html } = await import("./fixtures/scroll-element-by/layout.html?raw");
            document.body.innerHTML = html;
            window.scrollTo(0, 0);

            scrollElementBy(document.body.parentElement as Element, 120 as Coord<"page", "css", "y">);

            expect(window.scrollY).toBeGreaterThan(0);
        });
    });
});
