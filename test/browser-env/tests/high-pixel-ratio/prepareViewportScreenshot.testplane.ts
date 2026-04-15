import { prepareViewportScreenshot } from "../../../../src/browser/client-scripts/screen-shooter/implementation";
import {
    computeDocumentSize,
    computeViewportOffset,
    computeViewportSize,
} from "../../../../src/browser/client-scripts/screen-shooter/operations";
import type { PrepareViewportScreenshotSuccess } from "../../../../src/browser/client-scripts/screen-shooter/types";
import { isBrowserSideError } from "../../../../src/browser/isomorphic/types";

function getPrepareResult(opts: Parameters<typeof prepareViewportScreenshot>[0]): PrepareViewportScreenshotSuccess {
    const result = prepareViewportScreenshot(opts);

    if (isBrowserSideError(result)) {
        throw new Error(`Browser-side error in prepareViewportScreenshot: ${result.errorCode}: ${result.message}`);
    }

    return result;
}

describe("prepareViewportScreenshot in high pixel ratio mode", () => {
    beforeEach(async () => {
        const { default: html } = await import("./fixtures/viewport-screenshot/dashboard-long-page.html?raw");
        document.body.innerHTML = html;
        document.body.style.margin = "0";
        window.scrollTo(0, 0);
    });

    it("returns viewport and document dimensions translated to device pixels", async () => {
        window.scrollTo(0, 245);

        const cssViewportSize = computeViewportSize().viewportSize;
        const cssViewportOffset = computeViewportOffset().viewportOffset;
        const cssDocumentSize = computeDocumentSize().documentSize;

        const result = getPrepareResult({ usePixelRatio: true });

        expect(result.pixelRatio).toBe(3);
        expect(result.viewportSize.width).toBe((cssViewportSize.width as number) * 3);
        expect(result.viewportSize.height).toBe((cssViewportSize.height as number) * 3);
        expect(result.viewportOffset.left).toBe(Math.floor(cssViewportOffset.left as number) * 3);
        expect(result.viewportOffset.top).toBe(Math.floor(cssViewportOffset.top as number) * 3);
        expect(result.documentSize.width).toBe(Math.ceil((cssDocumentSize.width as number) * 3));
        expect(result.documentSize.height).toBe(Math.ceil((cssDocumentSize.height as number) * 3));
    });
});
