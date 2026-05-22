import { computeCaptureSpecs } from "../../../../../src/browser/client-scripts/screen-shooter/operations";
import { createDebugLogger } from "../../../../../src/browser/client-scripts/shared/logger";
import { visualizeCaptureSpecs } from "../../utils";

describe("computeCaptureSpecs", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        document.body.style.cssText = "";
    });

    describe("error cases", () => {
        it("should throw when selectors array is empty", () => {
            expect(() => computeCaptureSpecs([])).toThrow("No selectors to compute capture area");
        });

        it("should throw on invalid CSS selector", () => {
            expect(() => computeCaptureSpecs(["[[[invalid"])).toThrow();
        });
    });

    describe("empty results", () => {
        it("should return empty array when selector matches nothing", () => {
            const result = computeCaptureSpecs([".nonexistent"]);
            expect(result).toEqual([]);
        });

        it("should return empty array when all matched elements are hidden", async () => {
            const { default: html } = await import("./fixtures/capture-areas/hidden-elements.html?raw");
            document.body.innerHTML = html;

            const result = computeCaptureSpecs([
                ".hidden-display",
                ".hidden-visibility",
                ".hidden-opacity",
                ".hidden-zero-size",
            ]);
            expect(result).toEqual([]);
        });
    });

    describe("single element", () => {
        it("should return rect for a single visible element", async ({ browser }) => {
            const { default: html } = await import("./fixtures/capture-areas/single-element.html?raw");
            document.body.innerHTML = html;

            const result = computeCaptureSpecs([".target"]);
            expect(result).toHaveLength(1);

            visualizeCaptureSpecs(result);
            await browser.assertView("single-element");
        });

        it("should expand rect to include box-shadow", async ({ browser }) => {
            const { default: html } = await import("./fixtures/capture-areas/box-shadow.html?raw");
            document.body.innerHTML = html;

            const result = computeCaptureSpecs([".shadow-target"]);
            expect(result).toHaveLength(1);

            visualizeCaptureSpecs(result);
            await browser.assertView("box-shadow");
        });

        it("should not expand rect for inset box-shadow", async ({ browser }) => {
            const { default: html } = await import("./fixtures/capture-areas/inset-box-shadow.html?raw");
            document.body.innerHTML = html;

            const result = computeCaptureSpecs([".inset-shadow-target"]);
            expect(result).toHaveLength(1);

            visualizeCaptureSpecs(result);
            await browser.assertView("inset-box-shadow");
        });

        it("should expand rect to include outline", async ({ browser }) => {
            const { default: html } = await import("./fixtures/capture-areas/outline.html?raw");
            document.body.innerHTML = html;

            const result = computeCaptureSpecs([".outline-target"]);
            expect(result).toHaveLength(1);

            visualizeCaptureSpecs(result);
            await browser.assertView("outline");
        });

        it("should not include pseudo-element geometry in base element capture rect", async ({ browser }) => {
            const { default: html } = await import("./fixtures/capture-areas/pseudo-elements.html?raw");
            document.body.innerHTML = html;

            const elementResult = computeCaptureSpecs([".pseudo-target"]);

            visualizeCaptureSpecs(elementResult);
            await browser.assertView("pseudo-elements");
        });

        it("should capture pseudo-elements when they are passed explicitly as selectors", async ({ browser }) => {
            const { default: html } = await import("./fixtures/capture-areas/pseudo-elements.html?raw");
            document.body.innerHTML = html;

            const result = computeCaptureSpecs([".pseudo-target::before", ".pseudo-target::after"]);
            expect(result).toHaveLength(2);

            visualizeCaptureSpecs(result);
            await browser.assertView("pseudo-elements");
        });

        it("should capture pseudo-elements positioned relative to an ancestor (not direct parent) when selected explicitly", async ({
            browser,
        }) => {
            const { default: html } = await import("./fixtures/capture-areas/pseudo-elements-ancestor-cb.html?raw");
            document.body.innerHTML = html;

            const result = computeCaptureSpecs([".parent::before", ".parent::after"]);
            expect(result).toHaveLength(2);

            visualizeCaptureSpecs(result);
            await browser.assertView("pseudo-elements-ancestor-cb");
        });

        it("should account for CSS transforms (translate, rotate, scale, skew) on pseudo-elements selected explicitly", async ({
            browser,
        }) => {
            const { default: html } = await import("./fixtures/capture-areas/transformed-pseudo-elements.html?raw");
            document.body.innerHTML = html;

            const result = computeCaptureSpecs([".target::before", ".target::after"]);
            expect(result).toHaveLength(2);

            visualizeCaptureSpecs(result);
            await browser.assertView("transformed-pseudo-elements");
        });

        it("should handle CSS transforms on the element itself (rotate, scale, translate, skew, combined)", async ({
            browser,
        }) => {
            const { default: html } = await import("./fixtures/capture-areas/transformed-element.html?raw");
            document.body.innerHTML = html;

            const result = computeCaptureSpecs([".rotated", ".scaled", ".translated", ".skewed", ".combined"]);
            expect(result).toHaveLength(5);

            visualizeCaptureSpecs(result);
            await browser.assertView("transformed-elements");
        });
    });

    describe("multiple elements", () => {
        it("should return rects for multiple selectors each matching one element", async ({ browser }) => {
            const { default: html } = await import("./fixtures/capture-areas/multiple-elements.html?raw");
            document.body.innerHTML = html;

            const result = computeCaptureSpecs([".a", ".b", ".c"]);
            expect(result).toHaveLength(3);

            visualizeCaptureSpecs(result);
            await browser.assertView("multiple-selectors");
        });

        it("should return rect for the first element when selector matches multiple elements", async ({ browser }) => {
            const { default: html } = await import("./fixtures/capture-areas/multiple-selector-matches.html?raw");
            document.body.innerHTML = html;

            const result = computeCaptureSpecs([".item"]);
            expect(result).toHaveLength(1);

            visualizeCaptureSpecs(result);
            await browser.assertView("multiple-matches");
        });

        it("should return duplicate rects when multiple selectors match the same element", async () => {
            const { default: html } = await import("./fixtures/capture-areas/single-element.html?raw");
            document.body.innerHTML = html;

            // Both selectors match the same .target element
            const result = computeCaptureSpecs([".target", "div.target"]);
            expect(result).toHaveLength(2);

            // Both rects should be identical
            expect(result[0]).toEqual(result[1]);
        });

        it("should only return visible elements from a mix of visible and hidden", async ({ browser }) => {
            const { default: html } = await import("./fixtures/capture-areas/hidden-elements.html?raw");
            document.body.innerHTML = html;

            const result = computeCaptureSpecs([
                ".visible",
                ".hidden-display",
                ".hidden-visibility",
                ".hidden-opacity",
                ".hidden-zero-size",
            ]);
            expect(result).toHaveLength(1);

            visualizeCaptureSpecs(result);
            await browser.assertView("mixed-visibility");
        });
    });

    describe("scrollable container", () => {
        it("should compute correct rect for element inside a scrolled container", async ({ browser }) => {
            const { default: html } = await import("./fixtures/capture-areas/scrollable-container.html?raw");
            document.body.innerHTML = html;

            const container = document.querySelector(".container")!;
            container.scrollTop = 200;

            const result = computeCaptureSpecs([".target"]);
            expect(result).toHaveLength(1);

            visualizeCaptureSpecs(result);
            await browser.assertView("scrollable-container-scrolled");
        });
    });

    describe("box model", () => {
        it("should include padding and border but not margin in bounding rect", async ({ browser }) => {
            const { default: html } = await import("./fixtures/capture-areas/margin-padding-border.html?raw");
            document.body.innerHTML = html;

            const result = computeCaptureSpecs([".box-model-target"]);
            expect(result).toHaveLength(1);

            visualizeCaptureSpecs(result);
            await browser.assertView("margin-padding-border");
        });

        it("should handle element partially off-screen", async ({ browser }) => {
            const { default: html } = await import("./fixtures/capture-areas/offscreen-element.html?raw");
            document.body.innerHTML = html;

            const result = computeCaptureSpecs([".offscreen"]);
            expect(result).toHaveLength(1);

            visualizeCaptureSpecs(result);
            await browser.assertView("offscreen");
        });

        it("should handle long element partially visible only after window scroll", async ({ browser }) => {
            const { default: html } = await import("./fixtures/capture-areas/partially-visible-after-scroll.html?raw");
            document.body.innerHTML = html;

            window.scrollTo(0, 560);

            const result = computeCaptureSpecs([".long-target"]);
            expect(result).toHaveLength(1);

            visualizeCaptureSpecs(result);
            await browser.assertView("partially-visible-after-scroll");
        });

        it("should handle elements with fractional pixel positions", async ({ browser }) => {
            const { default: html } = await import("./fixtures/capture-areas/fractional-positions.html?raw");
            document.body.innerHTML = html;

            const result = computeCaptureSpecs([".fractional", ".transformed"]);
            expect(result).toHaveLength(2);

            visualizeCaptureSpecs(result);
            await browser.assertView("fractional-positions");
        });
    });

    describe("nested elements", () => {
        it("should return separate rects for parent and children", async ({ browser }) => {
            const { default: html } = await import("./fixtures/capture-areas/nested-elements.html?raw");
            document.body.innerHTML = html;

            const result = computeCaptureSpecs([".parent", ".child"]);

            visualizeCaptureSpecs(result);
            await browser.assertView("nested-elements");
        });
    });

    describe("overflow clipping", () => {
        it("should clip visible rect to overflow:hidden container while full rect extends beyond", async ({
            browser,
        }) => {
            const { default: html } = await import("./fixtures/capture-areas/overflow-hidden.html?raw");
            document.body.innerHTML = html;

            const result = computeCaptureSpecs([".target"]);
            expect(result).toHaveLength(1);

            visualizeCaptureSpecs(result);
            await browser.assertView("overflow-hidden");
        });

        it("should clip visible rect to overflow:scroll container", async ({ browser }) => {
            const { default: html } = await import("./fixtures/capture-areas/overflow-scroll.html?raw");
            document.body.innerHTML = html;

            const logger = createDebugLogger({ debug: ["screen-shooter"] }, "screen-shooter");
            const result = computeCaptureSpecs([".target"], logger);
            expect(result).toHaveLength(1);

            visualizeCaptureSpecs(result);
            await browser.assertView("overflow-scroll");
        });

        it("should not clip fixed-position element by overflow:hidden ancestor", async ({ browser }) => {
            const { default: html } = await import("./fixtures/capture-areas/fixed-in-overflow.html?raw");
            document.body.innerHTML = html;

            const result = computeCaptureSpecs([".target"]);
            expect(result).toHaveLength(1);

            const spec = result[0];
            // Fixed element escapes overflow clipping — full and visible should be the same
            expect(spec.full.width).toBe(spec.visible.width);
            expect(spec.full.height).toBe(spec.visible.height);

            visualizeCaptureSpecs(result);
            await browser.assertView("fixed-in-overflow");
        });

        it("should not clip element inside fixed-position parent by overflow:hidden ancestor", async ({ browser }) => {
            const { default: html } = await import("./fixtures/capture-areas/fixed-parent-in-overflow-hidden.html?raw");
            document.body.innerHTML = html;

            const result = computeCaptureSpecs([".target"]);
            expect(result).toHaveLength(1);

            visualizeCaptureSpecs(result);
            await browser.assertView("fixed-parent-in-overflow-hidden-external-containing-block");
        });

        it("should not clip absolutely positioned element when containing block is outside overflow:hidden ancestor", async ({
            browser,
        }) => {
            const { default: html } = await import(
                "./fixtures/capture-areas/absolute-in-overflow-hidden-external-containing-block.html?raw"
            );
            document.body.innerHTML = html;

            const result = computeCaptureSpecs([".target"]);
            expect(result).toHaveLength(1);

            visualizeCaptureSpecs(result);
            await browser.assertView("target");
        });

        it("should not clip element inside absolutely positioned parent because it escapes overflow:hidden ancestor", async ({
            browser,
        }) => {
            const { default: html } = await import("./fixtures/capture-areas/absolute-overflows-parent.html?raw");
            document.body.innerHTML = html;

            const result = computeCaptureSpecs([".target"]);
            expect(result).toHaveLength(1);

            visualizeCaptureSpecs(result);
            await browser.assertView("target");
        });
    });
});
