import {
    addCoords,
    ceilCoords,
    equalsSize,
    floorCoords,
    fromBcrToRect,
    fromCaptureAreaToViewport,
    fromCssToDevice,
    fromCssToDeviceNumber,
    fromDeviceToCssNumber,
    fromViewportToCaptureArea,
    getBottom,
    getCoveringRect,
    getHeight,
    getIntersection,
    getMaxCoord,
    getMaxLength,
    getMinCoord,
    getRight,
    getSize,
    getWidth,
    intersectXBands,
    intersectYBands,
    prettySize,
    roundCoords,
    subtractCoords,
} from "src/browser/isomorphic/geometry";
import type { Coord, Length, Point, Rect, Size, XBand, YBand } from "src/browser/isomorphic/geometry";

describe("browser/isomorphic/geometry", () => {
    describe("getSize", () => {
        it("should return width and height from rect", () => {
            const rect = {
                left: 1 as Coord<"page", "css", "x">,
                top: 2 as Coord<"page", "css", "y">,
                width: 30 as Length<"css", "x">,
                height: 40 as Length<"css", "y">,
            } as Rect<"page", "css">;

            assert.deepEqual(getSize(rect), { width: 30, height: 40 });
        });
    });

    describe("addCoords", () => {
        it("should add coords of the same type", () => {
            const a = 10 as Coord<"viewport", "css", "y">;
            const b = -3 as Coord<"viewport", "css", "y">;

            assert.equal(addCoords(a, b), 7);
        });
    });

    describe("subtractCoords", () => {
        it("should subtract coords of the same type", () => {
            const a = 10 as Coord<"viewport", "device", "x">;
            const b = 4 as Coord<"viewport", "device", "x">;

            assert.equal(subtractCoords(a, b), 6);
        });
    });

    describe("equalsSize", () => {
        it("should compare size values", () => {
            const base = { width: 100 as Length<"css", "x">, height: 50 as Length<"css", "y"> } as Size<"css">;
            const same = { width: 100 as Length<"css", "x">, height: 50 as Length<"css", "y"> } as Size<"css">;
            const other = { width: 100 as Length<"css", "x">, height: 51 as Length<"css", "y"> } as Size<"css">;

            assert.isTrue(equalsSize(base, same));
            assert.isFalse(equalsSize(base, other));
        });
    });

    describe("prettySize", () => {
        it("should format size as text", () => {
            const size = { width: 10 as Length<"device", "x">, height: 20 as Length<"device", "y"> } as Size<"device">;

            assert.equal(prettySize(size), "10 x 20 (width x height)");
        });
    });

    describe("intersectYBands", () => {
        it("should return overlapping part of y-bands", () => {
            const a = { top: 10 as Coord<"viewport", "css", "y">, height: 20 as Length<"css", "y"> } as YBand<
                "viewport",
                "css"
            >;
            const b = { top: 25 as Coord<"viewport", "css", "y">, height: 20 as Length<"css", "y"> } as YBand<
                "viewport",
                "css"
            >;

            assert.deepEqual(intersectYBands(a, b), { top: 25, height: 5 });
        });

        it("should return null when there is no overlap", () => {
            const a = { top: 10 as Coord<"viewport", "css", "y">, height: 20 as Length<"css", "y"> } as YBand<
                "viewport",
                "css"
            >;
            const b = { top: 30 as Coord<"viewport", "css", "y">, height: 10 as Length<"css", "y"> } as YBand<
                "viewport",
                "css"
            >;

            assert.isNull(intersectYBands(a, b));
            assert.isNull(intersectYBands(a, null));
        });
    });

    describe("intersectXBands", () => {
        it("should return overlapping part of x-bands", () => {
            const a = { left: 10 as Coord<"viewport", "device", "x">, width: 20 as Length<"device", "x"> } as XBand<
                "viewport",
                "device"
            >;
            const b = { left: 25 as Coord<"viewport", "device", "x">, width: 20 as Length<"device", "x"> } as XBand<
                "viewport",
                "device"
            >;

            assert.deepEqual(intersectXBands(a, b), { left: 25, width: 5 });
        });

        it("should return null when there is no overlap", () => {
            const a = { left: 10 as Coord<"viewport", "device", "x">, width: 20 as Length<"device", "x"> } as XBand<
                "viewport",
                "device"
            >;
            const b = { left: 30 as Coord<"viewport", "device", "x">, width: 10 as Length<"device", "x"> } as XBand<
                "viewport",
                "device"
            >;

            assert.isNull(intersectXBands(a, b));
            assert.isNull(intersectXBands(a, null));
        });
    });

    describe("getIntersection", () => {
        it("should intersect two rects", () => {
            const a = {
                left: 0 as Coord<"viewport", "device", "x">,
                top: 0 as Coord<"viewport", "device", "y">,
                width: 10 as Length<"device", "x">,
                height: 10 as Length<"device", "y">,
            } as Rect<"viewport", "device">;
            const b = {
                left: 5 as Coord<"viewport", "device", "x">,
                top: 4 as Coord<"viewport", "device", "y">,
                width: 10 as Length<"device", "x">,
                height: 10 as Length<"device", "y">,
            } as Rect<"viewport", "device">;

            assert.deepEqual(getIntersection(a, b), { left: 5, top: 4, width: 5, height: 6 });
        });

        it("should return null when inputs do not intersect or are null", () => {
            const a = {
                left: 0 as Coord<"viewport", "device", "x">,
                top: 0 as Coord<"viewport", "device", "y">,
                width: 10 as Length<"device", "x">,
                height: 10 as Length<"device", "y">,
            } as Rect<"viewport", "device">;
            const b = {
                left: 20 as Coord<"viewport", "device", "x">,
                top: 20 as Coord<"viewport", "device", "y">,
                width: 10 as Length<"device", "x">,
                height: 10 as Length<"device", "y">,
            } as Rect<"viewport", "device">;

            assert.isNull(getIntersection(a, b));
            assert.isNull(getIntersection(a, null));
        });
    });

    describe("getHeight", () => {
        it("should return absolute difference between y coords", () => {
            const a = 12 as Coord<"page", "css", "y">;
            const b = 5 as Coord<"page", "css", "y">;

            assert.equal(getHeight(a, b), 7);
        });
    });

    describe("getWidth", () => {
        it("should return absolute difference between x coords", () => {
            const a = 12 as Coord<"page", "device", "x">;
            const b = 5 as Coord<"page", "device", "x">;

            assert.equal(getWidth(a, b), 7);
        });
    });

    describe("getBottom", () => {
        it("should return top plus height", () => {
            const band = { top: 10 as Coord<"viewport", "css", "y">, height: 15 as Length<"css", "y"> } as YBand<
                "viewport",
                "css"
            >;

            assert.equal(getBottom(band), 25);
        });
    });

    describe("getRight", () => {
        it("should return left plus width", () => {
            const band = { left: 10 as Coord<"viewport", "device", "x">, width: 15 as Length<"device", "x"> } as XBand<
                "viewport",
                "device"
            >;

            assert.equal(getRight(band), 25);
        });
    });

    describe("getMaxLength", () => {
        it("should return max length", () => {
            const a = 5 as Length<"css", "y">;
            const b = 10 as Length<"css", "y">;
            const c = 3 as Length<"css", "y">;

            assert.equal(getMaxLength(a, b, c), 10);
        });
    });

    describe("getMaxCoord", () => {
        it("should return max coord", () => {
            const a = 5 as Coord<"viewport", "css", "x">;
            const b = 10 as Coord<"viewport", "css", "x">;
            const c = 3 as Coord<"viewport", "css", "x">;

            assert.equal(getMaxCoord(a, b, c), 10);
        });
    });

    describe("getMinCoord", () => {
        it("should return min coord", () => {
            const a = 5 as Coord<"viewport", "css", "x">;
            const b = 10 as Coord<"viewport", "css", "x">;
            const c = 3 as Coord<"viewport", "css", "x">;

            assert.equal(getMinCoord(a, b, c), 3);
        });
    });

    describe("fromCaptureAreaToViewport", () => {
        it("should convert capture-area coord to viewport coord", () => {
            const relative = 30 as Coord<"capture", "device", "y">;
            const captureTop = 100 as Coord<"viewport", "device", "y">;

            assert.equal(fromCaptureAreaToViewport(relative, captureTop), 130);
        });
    });

    describe("fromViewportToCaptureArea", () => {
        it("should convert viewport coord to capture-area coord", () => {
            const viewportCoord = 130 as Coord<"viewport", "device", "y">;
            const captureTop = 100 as Coord<"viewport", "device", "y">;

            assert.equal(fromViewportToCaptureArea(viewportCoord, captureTop), 30);
        });

        it("should preserve negative offsets above capture-area top", () => {
            const viewportCoord = 70 as Coord<"viewport", "device", "y">;
            const captureTop = 100 as Coord<"viewport", "device", "y">;

            assert.equal(fromViewportToCaptureArea(viewportCoord, captureTop), -30);
        });

        it("should be inverse of fromCaptureAreaToViewport", () => {
            const captureRelative = -15 as Coord<"capture", "device", "y">;
            const captureTop = 100 as Coord<"viewport", "device", "y">;

            const viewportCoord = fromCaptureAreaToViewport(captureRelative, captureTop);

            assert.equal(fromViewportToCaptureArea(viewportCoord, captureTop), captureRelative);
        });
    });

    describe("getCoveringRect", () => {
        it("should return the smallest rect covering all rects", () => {
            const a = {
                left: 10 as Coord<"viewport", "device", "x">,
                top: 20 as Coord<"viewport", "device", "y">,
                width: 30 as Length<"device", "x">,
                height: 40 as Length<"device", "y">,
            } as Rect<"viewport", "device">;
            const b = {
                left: 5 as Coord<"viewport", "device", "x">,
                top: 30 as Coord<"viewport", "device", "y">,
                width: 10 as Length<"device", "x">,
                height: 10 as Length<"device", "y">,
            } as Rect<"viewport", "device">;

            assert.deepEqual(getCoveringRect([a, b]), { left: 5, top: 20, width: 35, height: 40 });
        });

        it("should throw for empty rect list", () => {
            assert.throws(() => getCoveringRect([] as Rect<"viewport", "device">[]), /No rectangles to cover/);
        });
    });

    describe("roundCoords", () => {
        it("should floor start coords and ceil end coords", () => {
            const rect = {
                left: 5.6 as Coord<"viewport", "css", "x">,
                top: 10.2 as Coord<"viewport", "css", "y">,
                width: 1.1 as Length<"css", "x">,
                height: 2.2 as Length<"css", "y">,
            } as Rect<"viewport", "css">;

            assert.deepEqual(roundCoords(rect), { left: 5, top: 10, width: 2, height: 3 });
        });
    });

    describe("floorCoords", () => {
        it("should floor all numeric fields", () => {
            const point = { left: 5.8 as Coord<"page", "css", "x">, top: 10.2 as Coord<"page", "css", "y"> } as Point<
                "page",
                "css"
            >;

            assert.deepEqual(floorCoords(point), { left: 5, top: 10 });
        });
    });

    describe("ceilCoords", () => {
        it("should ceil all numeric fields", () => {
            const size = { width: 10.1 as Length<"css", "x">, height: 5.01 as Length<"css", "y"> } as Size<"css">;

            assert.deepEqual(ceilCoords(size), { width: 11, height: 6 });
        });
    });

    describe("fromCssToDevice", () => {
        it("should scale values without rounding for integer pixel ratio", () => {
            const rect = {
                left: 0.25 as Coord<"viewport", "css", "x">,
                top: 0.5 as Coord<"viewport", "css", "y">,
                width: 10.25 as Length<"css", "x">,
                height: 20.5 as Length<"css", "y">,
            } as Rect<"viewport", "css">;

            assert.deepEqual(fromCssToDevice(rect, 2), { left: 0.5, top: 1, width: 20.5, height: 41 });
        });

        it("should scale and round rect values for fractional pixel ratio", () => {
            const rect = {
                left: 1 as Coord<"viewport", "css", "x">,
                top: 2 as Coord<"viewport", "css", "y">,
                width: 3 as Length<"css", "x">,
                height: 4 as Length<"css", "y">,
            } as Rect<"viewport", "css">;

            assert.deepEqual(fromCssToDevice(rect, 1.5), { left: 1, top: 3, width: 5, height: 6 });
        });
    });

    describe("fromCssToDeviceNumber", () => {
        it("should scale coords and lengths", () => {
            const top = 10 as Coord<"viewport", "css", "y">;
            const width = 3 as Length<"css", "x">;

            assert.equal(fromCssToDeviceNumber(top, 2), 20);
            assert.equal(fromCssToDeviceNumber(width, 2), 6);
        });
    });

    describe("fromDeviceToCssNumber", () => {
        it("should downscale coords and lengths", () => {
            const top = 20 as Coord<"viewport", "device", "y">;
            const width = 6 as Length<"device", "x">;

            assert.equal(fromDeviceToCssNumber(top, 2), 10);
            assert.equal(fromDeviceToCssNumber(width, 2), 3);
        });
    });

    describe("fromBcrToRect", () => {
        it("should map DOMRect to a viewport css rect", () => {
            const bcr = { left: 1, top: 2, width: 3, height: 4 } as DOMRect;

            assert.deepEqual(fromBcrToRect(bcr), { left: 1, top: 2, width: 3, height: 4 });
        });
    });

    // Compile-time checks. Kept skipped because they validate types, not runtime behavior.
    describe("types", () => {
        it.skip("should keep helper contracts type-safe", () => {
            const viewportTopCss = 10 as Coord<"viewport", "css", "y">;
            const viewportLeftCss = 5 as Coord<"viewport", "css", "x">;
            const pageTopCss = 7 as Coord<"page", "css", "y">;
            const captureTopCss = 2 as Coord<"capture", "css", "y">;
            const viewportTopDevice = 20 as Coord<"viewport", "device", "y">;
            const cssWidth = 3 as Length<"css", "x">;

            const sum: Coord<"viewport", "css", "y"> = addCoords(viewportTopCss, viewportTopCss);
            const diff: Coord<"viewport", "css", "y"> = subtractCoords(viewportTopCss, viewportTopCss);
            const height: Length<"css", "y"> = getHeight(viewportTopCss, viewportTopCss);
            const width: Length<"css", "x"> = getWidth(viewportLeftCss, viewportLeftCss);
            const viewportTop = fromCaptureAreaToViewport(captureTopCss, viewportTopCss);
            const captureTop = fromViewportToCaptureArea(viewportTopCss, viewportTopCss);
            const deviceWidth = fromCssToDeviceNumber(cssWidth, 2);
            const cssTop = fromDeviceToCssNumber(viewportTopDevice, 2);

            void [sum, diff, height, width, viewportTop, captureTop, deviceWidth, cssTop];

            // @ts-expect-error different axis
            addCoords(viewportTopCss, viewportLeftCss);
            // @ts-expect-error different space
            subtractCoords(viewportTopCss, pageTopCss);
            // @ts-expect-error getWidth expects x-coords
            getWidth(viewportTopCss, viewportTopCss);
            // @ts-expect-error getHeight expects y-coords
            getHeight(viewportLeftCss, viewportLeftCss);
            // @ts-expect-error first arg should be capture-space y-coord
            fromCaptureAreaToViewport(viewportTopCss, viewportTopCss);
            // @ts-expect-error first arg should be viewport-space y-coord
            fromViewportToCaptureArea(captureTopCss, viewportTopCss);
            // @ts-expect-error css length converts to device length
            const wrongLength: Length<"css", "x"> = fromCssToDeviceNumber(cssWidth, 2);
            // @ts-expect-error device coord converts to css coord
            const wrongCoord: Coord<"viewport", "device", "y"> = fromDeviceToCssNumber(viewportTopDevice, 2);
            void [wrongLength, wrongCoord];
        });
    });
});
