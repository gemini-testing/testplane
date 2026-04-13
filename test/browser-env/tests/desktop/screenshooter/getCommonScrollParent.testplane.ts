import { getCommonScrollParent } from "../../../../../src/browser/client-scripts/screen-shooter/utils/scroll";

function query(selector: string): Element {
    const el = document.querySelector(selector);
    if (!el) {
        throw new Error(`Element not found: ${selector}`);
    }
    return el;
}

describe("getCommonScrollParent", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        document.body.style.cssText = "";
        window.scrollTo(0, 0);
    });

    it("should return documentElement when selectors array is empty", () => {
        const result = getCommonScrollParent([]);

        expect(result).toBe(document.documentElement);
    });

    it("should return documentElement when none of selectors match", async () => {
        const { default: html } = await import("./fixtures/common-scroll-parent/analytics-dashboard.html?raw");
        document.body.innerHTML = html;

        const result = getCommonScrollParent([".missing-a", ".missing-b"]);

        expect(result).toBe(document.documentElement);
    });

    it("should return nearest scrollable parent for a single matched selector", async () => {
        const { default: html } = await import("./fixtures/common-scroll-parent/analytics-dashboard.html?raw");
        document.body.innerHTML = html;

        const result = getCommonScrollParent(["#single-in-dashboard"]);
        const expected = query(".dashboard-scroll");

        expect(result).toBe(expected);
    });

    it("should return documentElement for a single matched selector inside fixed overlay", async () => {
        const { default: html } = await import("./fixtures/common-scroll-parent/fixed-modal.html?raw");
        document.body.innerHTML = html;

        const result = getCommonScrollParent(["#modal-target"]);
        expect(result).toBe(document.documentElement);
    });

    it("should return deepest common scroll parent for multiple selectors in same nested scroll container", async () => {
        const { default: html } = await import("./fixtures/common-scroll-parent/analytics-dashboard.html?raw");
        document.body.innerHTML = html;

        const result = getCommonScrollParent(["#feed-item-a", "#feed-item-b"]);
        const expected = query(".feed-scroll");

        expect(result).toBe(expected);
    });

    it("should return outer shared scroll parent when elements belong to different nested scroll levels", async () => {
        const { default: html } = await import("./fixtures/common-scroll-parent/analytics-dashboard.html?raw");
        document.body.innerHTML = html;

        const result = getCommonScrollParent(["#dashboard-item", "#feed-item-b"]);
        const expected = query(".dashboard-scroll");

        expect(result).toBe(expected);
    });

    it("should return documentElement when matched elements belong to different independent scroll roots", async () => {
        const { default: html } = await import("./fixtures/common-scroll-parent/split-panels.html?raw");
        document.body.innerHTML = html;

        const result = getCommonScrollParent(["#left-target", "#right-target"]);

        expect(result).toBe(document.documentElement);
    });

    it("should ignore unmatched selectors and compute parent from matched ones", async () => {
        const { default: html } = await import("./fixtures/common-scroll-parent/split-panels.html?raw");
        document.body.innerHTML = html;

        const result = getCommonScrollParent(["#left-target", ".non-existent-selector"]);
        const expected = query(".left-panel");

        expect(result).toBe(expected);
    });
});
