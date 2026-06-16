import { computeViewportSize } from "../../../../../src/browser/client-scripts/screen-shooter/operations";

describe("computeViewportSize", () => {
    it("should return the viewport size", () => {
        const viewportSize = computeViewportSize();

        expect(viewportSize.width).toBe(1280);
        expect(viewportSize.height).toBe(1000);
    });
});
