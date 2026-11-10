export class PixelRatioChangeError extends Error {
    constructor(readonly pixelRatio: number) {
        super("Estimated pixel ratio did not match actual pixel ratio during capture");
        this.name = "PixelRatioChangeError";
    }
}
