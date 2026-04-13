import {
    computeCaptureSpecs,
    computeSafeArea,
    computeViewportSize,
} from "../../../../../src/browser/client-scripts/screen-shooter/operations";
import { createDebugLogger } from "../../../../../src/browser/client-scripts/shared/logger";
import { visualizeCaptureSpecs, visualizeSafeArea } from "../../utils";

describe("computeSafeArea", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        document.body.style.cssText = "";
    });

    it("should shrink safe area below a fixed app header", async ({ browser }) => {
        const { default: html } = await import("./fixtures/safe-areas/fixed-app-header.html?raw");
        document.body.innerHTML = html;

        const selectors = [".target"];
        const safeArea = computeSafeArea(selectors).safeArea;
        const captureSpecs = computeCaptureSpecs(selectors).captureSpecs;

        expect(captureSpecs).toHaveLength(1);
        expect(safeArea.top).toBeGreaterThan(0);

        visualizeCaptureSpecs(captureSpecs);
        visualizeSafeArea(safeArea.top, safeArea.height);
        await browser.assertView("compute-safe-area-fixed-app-header");
    });

    it("should shrink from bottom for cookie consent bar", async ({ browser }) => {
        const { default: html } = await import("./fixtures/safe-areas/cookie-consent-bar.html?raw");
        document.body.innerHTML = html;

        const selectors = [".target"];
        const safeArea = computeSafeArea(selectors).safeArea;
        const captureSpecs = computeCaptureSpecs(selectors).captureSpecs;

        expect(captureSpecs).toHaveLength(1);

        visualizeCaptureSpecs(captureSpecs);
        visualizeSafeArea(safeArea.top, safeArea.height);
        await browser.assertView("compute-safe-area-cookie-consent-bar");
    });

    it("should not shrink for backdrop behind focused modal", async ({ browser }) => {
        const { default: html } = await import("./fixtures/safe-areas/modal-with-backdrop.html?raw");
        document.body.innerHTML = html;

        const selectors = [".target-modal"];
        const safeArea = computeSafeArea(selectors).safeArea;
        const captureSpecs = computeCaptureSpecs(selectors).captureSpecs;

        visualizeCaptureSpecs(captureSpecs);
        visualizeSafeArea(safeArea.top, safeArea.height);
        await browser.assertView("compute-safe-area-modal-backdrop");
    });

    it("should ignore fixed help button with no horizontal overlap", async ({ browser }) => {
        const { default: html } = await import("./fixtures/safe-areas/floating-help-button.html?raw");
        document.body.innerHTML = html;

        const selectors = [".target"];
        const safeArea = computeSafeArea(selectors).safeArea;
        const captureSpecs = computeCaptureSpecs(selectors).captureSpecs;

        visualizeCaptureSpecs(captureSpecs);
        visualizeSafeArea(safeArea.top, safeArea.height);
        await browser.assertView("compute-safe-area-floating-help-button");
    });

    it("should handle sticky toolbar inside scrollable panel", async ({ browser }) => {
        const { default: html } = await import("./fixtures/safe-areas/sticky-toolbar-in-panel.html?raw");
        document.body.innerHTML = html;

        const panel = document.querySelector(".panel");
        if (!panel) {
            throw new Error("Failed to find .panel");
        }

        const selectors = [".target"];
        const safeArea = computeSafeArea(selectors, panel).safeArea;
        const captureSpecs = computeCaptureSpecs(selectors).captureSpecs;

        expect(captureSpecs).toHaveLength(1);

        visualizeCaptureSpecs(captureSpecs);
        visualizeSafeArea(safeArea.top, safeArea.height);
        await browser.assertView("compute-safe-area-sticky-toolbar-in-panel");
    });

    it("should compute safe area for capture inside scrollable panel with large border radius", async ({ browser }) => {
        const { default: html } = await import(
            "./fixtures/safe-areas/scrollable-container-with-border-radius.html?raw"
        );
        document.body.innerHTML = html;

        const panel = document.querySelector(".panel");
        if (!panel) {
            throw new Error("Failed to find .panel");
        }

        const selectors = [".content"];
        const safeArea = computeSafeArea(selectors, panel).safeArea;
        const captureSpecs = computeCaptureSpecs(selectors).captureSpecs;

        visualizeCaptureSpecs(captureSpecs);
        visualizeSafeArea(safeArea.top, safeArea.height);
        await browser.assertView("compute-safe-area-scrollable-container-with-border-radius");
    });

    it("should compute safe area for target element inside fixed element", async ({ browser }) => {
        const { default: html } = await import("./fixtures/safe-areas/target-element-inside-fixed.html?raw");
        document.body.innerHTML = html;

        const logger = createDebugLogger(
            { debug: ["testplane:screenshots:browser:computeSafeArea"] },
            "testplane:screenshots:browser:computeSafeArea",
        );

        const selectors = [".target"];
        const safeArea = computeSafeArea(selectors, undefined, logger).safeArea;
        const captureSpecs = computeCaptureSpecs(selectors).captureSpecs;

        visualizeCaptureSpecs(captureSpecs);
        visualizeSafeArea(safeArea.top, safeArea.height);
        await browser.assertView("compute-safe-area-target-element-inside-fixed");

        console.log(logger.log);
    });

    it("should handle sticky header with shadow", async ({ browser }) => {
        const { default: html } = await import("./fixtures/safe-areas/sticky-header-with-shadow.html?raw");
        document.body.innerHTML = html;

        const selectors = [".target"];
        const safeArea = computeSafeArea(selectors).safeArea;

        visualizeSafeArea(safeArea.top, safeArea.height);
        await browser.assertView("compute-safe-area-sticky-header-with-shadow");
    });

    it("should not shrink safe area if fixed element is outside of viewport", async ({ browser }) => {
        const { default: html } = await import("./fixtures/safe-areas/fixed-element-outside-of-viewport.html?raw");
        document.body.innerHTML = html;

        const logger = createDebugLogger(
            { debug: ["testplane:screenshots:browser:computeSafeArea"] },
            "testplane:screenshots:browser:computeSafeArea",
        );

        const selectors = [".target"];
        const safeArea = computeSafeArea(selectors, undefined, logger).safeArea;
        const captureSpecs = computeCaptureSpecs(selectors).captureSpecs;

        visualizeCaptureSpecs(captureSpecs);
        visualizeSafeArea(safeArea.top, safeArea.height);
        await browser.assertView("compute-safe-area-fixed-element-outside-of-viewport");
    });

    it("should ignore obstruction if shrinking would exceed half of original safe area", async ({ browser }) => {
        const { default: html } = await import("./fixtures/safe-areas/huge-fixed-banner.html?raw");
        document.body.innerHTML = html;

        const selectors = [".target"];
        const safeArea = computeSafeArea(selectors).safeArea;
        const captureSpecs = computeCaptureSpecs(selectors).captureSpecs;

        visualizeCaptureSpecs(captureSpecs);
        visualizeSafeArea(safeArea.top, safeArea.height);
        await browser.assertView("compute-safe-area-huge-fixed-banner");
    });

    it("should return full viewport when no selectors match", () => {
        document.body.innerHTML = "<div>some content</div>";

        const { viewportSize } = computeViewportSize();
        const safeArea = computeSafeArea([".does-not-exist"]).safeArea;

        expect(safeArea.top).toBe(0);
        expect(safeArea.height).toBe(viewportSize.height);
    });

    it("should shrink from bottom for sticky footer in panel", async ({ browser }) => {
        const { default: html } = await import("./fixtures/safe-areas/sticky-footer-in-panel.html?raw");
        document.body.innerHTML = html;

        const panel = document.querySelector(".panel");
        if (!panel) {
            throw new Error("Failed to find .panel");
        }

        const selectors = [".target"];
        const safeArea = computeSafeArea(selectors, panel).safeArea;
        const captureSpecs = computeCaptureSpecs(selectors).captureSpecs;

        expect(captureSpecs).toHaveLength(1);

        visualizeCaptureSpecs(captureSpecs);
        visualizeSafeArea(safeArea.top, safeArea.height);
        await browser.assertView("compute-safe-area-sticky-footer-in-panel");
    });

    it("should not shrink for absolute element whose containing block is inside the panel", async ({ browser }) => {
        const { default: html } = await import("./fixtures/safe-areas/absolute-inside-scroll-panel.html?raw");
        document.body.innerHTML = html;

        const panel = document.querySelector(".panel");
        if (!panel) {
            throw new Error("Failed to find .panel");
        }

        const selectors = [".target"];
        const safeArea = computeSafeArea(selectors, panel).safeArea;
        const captureSpecs = computeCaptureSpecs(selectors).captureSpecs;

        visualizeCaptureSpecs(captureSpecs);
        visualizeSafeArea(safeArea.top, safeArea.height);
        await browser.assertView("compute-safe-area-absolute-inside-panel");
    });

    it("should shrink from both top and bottom for simultaneous header and footer", async ({ browser }) => {
        const { default: html } = await import("./fixtures/safe-areas/header-and-footer.html?raw");
        document.body.innerHTML = html;

        const selectors = [".target"];
        const safeArea = computeSafeArea(selectors).safeArea;
        const captureSpecs = computeCaptureSpecs(selectors).captureSpecs;

        const headerBcr = document.querySelector(".header")!.getBoundingClientRect();
        const footerBcr = document.querySelector(".footer")!.getBoundingClientRect();

        // Both elements must shrink the safe area — top moves down, bottom moves up
        expect(safeArea.top).toBeCloseTo(headerBcr.bottom, 0);
        expect(safeArea.top + safeArea.height).toBeCloseTo(footerBcr.top, 0);

        visualizeCaptureSpecs(captureSpecs);
        visualizeSafeArea(safeArea.top, safeArea.height);
        await browser.assertView("compute-safe-area-header-and-footer");
    });

    it("should treat absolute overlay outside panel as interference for panel scrolling", async ({ browser }) => {
        const { default: html } = await import("./fixtures/safe-areas/absolute-overlay-outside-panel.html?raw");
        document.body.innerHTML = html;

        const panel = document.querySelector(".panel");
        if (!panel) {
            throw new Error("Failed to find .panel");
        }

        const selectors = [".target"];
        const safeArea = computeSafeArea(selectors, panel).safeArea;
        const captureSpecs = computeCaptureSpecs(selectors).captureSpecs;

        expect(captureSpecs).toHaveLength(1);

        visualizeCaptureSpecs(captureSpecs);
        visualizeSafeArea(safeArea.top, safeArea.height);

        await browser.assertView("compute-safe-area-absolute-overlay-outside-panel");
    });

    it("should not shrink when fixed element is behind target due to z-index despite opacity stacking context", async ({
        browser,
    }) => {
        const { default: html } = await import("./fixtures/safe-areas/stacking-context-opacity-behind.html?raw");
        document.body.innerHTML = html;

        const selectors = [".target"];
        const safeArea = computeSafeArea(selectors).safeArea;

        // overlay: z:5 / target's container: z:10 -> isChainBehind returns true -> no shrink
        const { viewportSize } = computeViewportSize();
        expect(safeArea.top).toBe(0);
        expect(safeArea.height).toBe(viewportSize.height);

        visualizeSafeArea(safeArea.top, safeArea.height);
        await browser.assertView("compute-safe-area-stacking-context-opacity-behind");
    });

    it("should shrink for sticky header", async ({ browser }) => {
        const logger = createDebugLogger(
            { debug: ["testplane:screenshots:browser:computeSafeArea"] },
            "testplane:screenshots:browser:computeSafeArea",
        );

        const { default: html } = await import("./fixtures/safe-areas/simple-sticky-header.html?raw");
        document.body.innerHTML = html;

        window.scrollTo(0, document.documentElement.scrollHeight - document.documentElement.clientHeight - 200);

        const selectors = [".target"];
        const safeArea = computeSafeArea(selectors, undefined, logger).safeArea;

        visualizeSafeArea(safeArea.top, safeArea.height);
        await browser.assertView("compute-safe-area-stacking-context-filter-in-front");
    });

    it("should shrink for fixed header that creates stacking context via filter and is in front", async ({
        browser,
    }) => {
        const { default: html } = await import("./fixtures/safe-areas/stacking-context-filter-in-front.html?raw");
        document.body.innerHTML = html;

        window.scrollTo(0, 5000);

        const selectors = [".target"];
        const safeArea = computeSafeArea(selectors).safeArea;

        // header: z:10 / target: z:0 -> isChainBehind returns false -> does shrink
        const headerBcr = document.querySelector(".header")!.getBoundingClientRect();
        expect(safeArea.top).toBeCloseTo(headerBcr.bottom, 0);

        visualizeSafeArea(safeArea.top, safeArea.height);
        await browser.assertView("compute-safe-area-stacking-context-filter-in-front");
    });

    it("should not shrink when fixed overlay is behind a nested stacking context containing the target", async ({
        browser,
    }) => {
        const { default: html } = await import("./fixtures/safe-areas/nested-stacking-overlay-behind.html?raw");
        document.body.innerHTML = html;

        const selectors = [".target"];
        const safeArea = computeSafeArea(selectors).safeArea;

        // overlay: z:50 / app-shell: z:100 -> common ctx = documentElement -> 50 < 100 -> behind -> no shrink
        const { viewportSize } = computeViewportSize();
        expect(safeArea.top).toBe(0);
        expect(safeArea.height).toBe(viewportSize.height);

        visualizeSafeArea(safeArea.top, safeArea.height);
        await browser.assertView("compute-safe-area-nested-stacking-overlay-behind");
    });

    it("should shrink when fixed overlay is in front of a nested stacking context containing the target", async ({
        browser,
    }) => {
        const { default: html } = await import("./fixtures/safe-areas/nested-stacking-overlay-in-front.html?raw");
        document.body.innerHTML = html;

        const selectors = [".target"];
        const safeArea = computeSafeArea(selectors).safeArea;

        // overlay: z:50 / app-shell: z:10 -> common ctx = documentElement -> 50 < 10 is false -> in front -> does shrink
        const overlayBcr = document.querySelector(".fixed-overlay")!.getBoundingClientRect();
        expect(safeArea.top).toBeCloseTo(overlayBcr.bottom, 0);

        visualizeSafeArea(safeArea.top, safeArea.height);
        await browser.assertView("compute-safe-area-nested-stacking-overlay-in-front");
    });
});
