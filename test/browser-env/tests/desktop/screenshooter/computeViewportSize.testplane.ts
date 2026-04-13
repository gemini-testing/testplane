import { computeViewportSize } from "../../../../../src/browser/client-scripts/screen-shooter/operations";

describe("computeViewportSize", () => {
    it("should return the viewport size", () => {
        const viewportSize = computeViewportSize();

        expect(viewportSize.viewportSize.width).toBe(1280);
        expect(viewportSize.viewportSize.height).toBe(1000);
    });
});
