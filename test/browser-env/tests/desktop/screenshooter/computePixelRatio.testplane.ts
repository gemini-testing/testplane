import { computePixelRatio } from "../../../../../src/browser/client-scripts/screen-shooter/operations";

describe("computePixelRatio", () => {
    testplane.only.in("chrome-mobile-dpr3");
    it("returns emulated mobile pixel ratio from window.devicePixelRatio", () => {
        const pixelRatio = computePixelRatio().pixelRatio;
        expect(pixelRatio).toBe(3);
    });

    testplane.only.in("chrome-mobile-dpr3");
    it("returns 1 when usePixelRatio is disabled", () => {
        const pixelRatio = computePixelRatio(false).pixelRatio;
        expect(pixelRatio).toBe(1);
    });
});
