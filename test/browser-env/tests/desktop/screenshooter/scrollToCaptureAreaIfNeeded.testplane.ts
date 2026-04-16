import { getCoveringRect } from "../../../../../src/browser/isomorphic";
import { OutsideOfViewportError } from "../../../../../src/browser/client-scripts/screen-shooter/errors/outside-of-viewport";
import {
    computeCaptureSpecs,
    computeSafeArea,
    scrollToCaptureAreaIfNeeded,
} from "../../../../../src/browser/client-scripts/screen-shooter/operations";

function clientRectSnapshot(el: Element): { top: number; left: number; width: number; height: number } {
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function expectClientRectClose(
    a: { top: number; left: number; width: number; height: number },
    b: { top: number; left: number; width: number; height: number },
    tol = 1,
): void {
    expect(a.top).toBeCloseTo(b.top, tol);
    expect(a.left).toBeCloseTo(b.left, tol);
    expect(a.width).toBeCloseTo(b.width, tol);
    expect(a.height).toBeCloseTo(b.height, tol);
}

function coveringFullTop(selectors: string[]): number {
    const specs = computeCaptureSpecs(selectors).captureSpecs;
    const area = getCoveringRect(specs.map(s => s.full));
    return area.top as number;
}

function expectCaptureAlignedToSafeArea(selectors: string[], scrollElement: Element | undefined): void {
    const top = coveringFullTop(selectors);
    const safe = computeSafeArea(selectors, scrollElement).safeArea;
    expect(top).toBeCloseTo(safe.top as number, 0);
}

describe("scrollToCaptureAreaIfNeeded", () => {
    beforeEach(() => {
        window.scrollTo(0, 0);
        document.body.innerHTML = "";
        document.body.style.cssText = "";
    });

    it("should throw OutsideOfViewportError when the target is outside the viewport and captureElementFromTop is false", async () => {
        const { default: html } = await import("./fixtures/scroll-to-capture/below-fold-window.html?raw");
        document.body.innerHTML = html;

        const target = document.querySelector(".target")!;
        const before = clientRectSnapshot(target);

        expect(() => scrollToCaptureAreaIfNeeded([".target"], false)).toThrow(OutsideOfViewportError);

        expectClientRectClose(clientRectSnapshot(target), before);
        expect(window.scrollY).toBe(0);
    });

    it("should not scroll when the target is already in view", async () => {
        const { default: html } = await import("./fixtures/scroll-to-capture/visible-target.html?raw");
        document.body.innerHTML = html;
        const scrollBefore = window.scrollY;

        scrollToCaptureAreaIfNeeded([".target"], true);

        expect(window.scrollY).toBe(scrollBefore);
    });

    it("should scroll when the target starts above the viewport", async () => {
        const { default: html } = await import("./fixtures/scroll-to-capture/window-then-panel-scroll.html?raw");
        document.body.innerHTML = html;

        const target = document.getElementById("capture-panel")!;
        window.scrollTo(0, target!.getBoundingClientRect().top + 100);

        expect(target.getBoundingClientRect().top).toBeLessThan(0);

        scrollToCaptureAreaIfNeeded(["#capture-panel"], true);

        expect(target.getBoundingClientRect().top).toBe(0);
    });

    it("should treat omitted captureElementFromTop like false for an in-viewport target", async () => {
        const { default: html } = await import("./fixtures/scroll-to-capture/visible-target.html?raw");
        document.body.innerHTML = html;

        const target = document.querySelector(".target")!;
        const before = clientRectSnapshot(target);

        const result = scrollToCaptureAreaIfNeeded([".target"]);

        expect(result).toEqual({});
        expectClientRectClose(clientRectSnapshot(target), before);
    });

    it("should return {} without scrolling when captureElementFromTop is true but the safe-area intersection is already tall enough", async () => {
        const { default: html } = await import("./fixtures/safe-areas/fixed-app-header.html?raw");
        document.body.innerHTML = html;

        const target = document.querySelector(".target")!;
        const before = clientRectSnapshot(target);
        const scrollBefore = window.scrollY;

        const result = scrollToCaptureAreaIfNeeded([".target"], true);

        expect(result).toEqual({});
        expectClientRectClose(clientRectSnapshot(target), before);
        expect(window.scrollY).toBe(scrollBefore);
    });

    it("should scroll the window so the capture area aligns with the safe area when the target is below the fold", async () => {
        const { default: html } = await import("./fixtures/scroll-to-capture/below-fold-window.html?raw");
        document.body.innerHTML = html;

        const target = document.querySelector(".target")!;
        const before = clientRectSnapshot(target);
        expect(before.top).toBeGreaterThan(700);

        const result = scrollToCaptureAreaIfNeeded([".target"], true);

        expect(result).toEqual({ readableSelectorToScrollDescr: "html" });
        expect(window.scrollY).toBeGreaterThan(0);
        expectCaptureAlignedToSafeArea([".target"], document.documentElement);
        expect(clientRectSnapshot(target).top).toBeLessThan(before.top);
    });

    it("should scroll the window to the panel and then scrolls inside the panel", async () => {
        const { default: html } = await import("./fixtures/scroll-to-capture/window-then-panel-scroll.html?raw");
        document.body.innerHTML = html;

        const panel = document.querySelector("#capture-panel")!;
        const target = document.querySelector(".target")!;
        panel.scrollTop = 0;
        window.scrollTo(0, 0);

        const before = clientRectSnapshot(target);
        expect(before.top).toBeGreaterThan(window.innerHeight);
        expect(panel.scrollTop).toBe(0);

        const result = scrollToCaptureAreaIfNeeded([".target"], true);

        expect(result.readableSelectorToScrollDescr).toBe("div#capture-panel");
        expect(window.scrollY).toBeGreaterThan(0);
        expect(panel.scrollTop).toBeGreaterThan(0);
        expect(clientRectSnapshot(target).top).toBeLessThan(before.top);
        expectCaptureAlignedToSafeArea([".target"], panel);
    });

    it("should scroll a single overflow container without changing window scroll", async () => {
        const { default: html } = await import("./fixtures/scroll-to-capture/scrollable-container.html?raw");
        document.body.innerHTML = html;

        const container = document.querySelector(".container")!;
        const target = document.querySelector(".target")!;
        container.scrollTop = 0;

        const before = clientRectSnapshot(target);
        expect(before.top).toBeGreaterThan(container.getBoundingClientRect().bottom);

        const result = scrollToCaptureAreaIfNeeded([".target"], true);

        expect(result.readableSelectorToScrollDescr).toMatch(/container/);
        expect(window.scrollY).toBe(0);
        expect(container.scrollTop).toBeGreaterThan(0);
        expectCaptureAlignedToSafeArea([".target"], container);
    });

    it("should walk nested scroll parents and align the capture area to the inner scroll root safe area", async () => {
        const { default: html } = await import("./fixtures/scroll-to-capture/nested-scroll.html?raw");
        document.body.innerHTML = html;

        const outer = document.querySelector(".outer")!;
        const inner = document.querySelector(".inner")!;
        const target = document.querySelector(".target")!;

        outer.scrollTop = 0;
        inner.scrollTop = 0;
        window.scrollTo(0, 0);

        const before = clientRectSnapshot(target);
        expect(before.top).toBeGreaterThan(inner.getBoundingClientRect().bottom - 20);

        const result = scrollToCaptureAreaIfNeeded([".target"], true);

        expect(inner.className).toContain("inner");
        expect(result.readableSelectorToScrollDescr).toMatch(/inner/);
        expect(outer.scrollTop).toBeGreaterThan(0);
        expect(inner.scrollTop).toBeGreaterThan(0);
        expectCaptureAlignedToSafeArea([".target"], inner);
    });

    it("should use selectorToScroll as the scroll root and report it in readableSelectorToScrollDescr", async () => {
        const { default: html } = await import("./fixtures/scroll-to-capture/labeled-scroll-panel.html?raw");
        document.body.innerHTML = html;

        const panel = document.querySelector("#labeled-panel")!;
        const target = document.querySelector(".target")!;
        panel.scrollTop = 0;

        const before = clientRectSnapshot(target);
        expect(before.top).toBeGreaterThan(panel.getBoundingClientRect().bottom);

        const result = scrollToCaptureAreaIfNeeded([".target"], true, false, "#labeled-panel");

        expect(result).toEqual({ readableSelectorToScrollDescr: "#labeled-panel" });
        expect(panel.scrollTop).toBeGreaterThan(0);
        expect(window.scrollY).toBe(0);
        expectCaptureAlignedToSafeArea([".target"], panel);
    });

    it("should fall back to the common scroll parent when selectorToScroll does not match any element", async () => {
        const { default: html } = await import("./fixtures/scroll-to-capture/labeled-scroll-panel.html?raw");
        document.body.innerHTML = html;

        const panel = document.querySelector("#labeled-panel")!;
        const target = document.querySelector(".target")!;
        panel.scrollTop = 0;

        const before = clientRectSnapshot(target);

        const result = scrollToCaptureAreaIfNeeded([".target"], true, false, ".nonexistent-scroll-root");

        expect(result).toEqual({ readableSelectorToScrollDescr: ".nonexistent-scroll-root" });
        expect(panel.scrollTop).toBeGreaterThan(0);
        expect(window.scrollY).toBe(0);
        expect(clientRectSnapshot(target).top).toBeLessThan(before.top);
        expectCaptureAlignedToSafeArea([".target"], panel);
    });
});
