"use strict";

const _ = require("lodash");
const proxyquire = require("proxyquire");
const { assertPixelRatio } = require("src/browser/screen-shooter/validation");
const { PixelRatioChangeError } = require("src/browser/screen-shooter/errors/pixel-ratio-change-error");

describe("assertCorrectCaptureAreaBounds", () => {
    const loggerWarnStub = sinon.stub();
    let assertCorrectCaptureAreaBounds;

    beforeEach(() => {
        loggerWarnStub.resetHistory();
        loggerWarnStub.resetBehavior();

        ({ assertCorrectCaptureAreaBounds } = proxyquire("src/browser/screen-shooter/validation", {
            "../../../utils/logger": {
                warn: loggerWarnStub,
            },
        }));
    });

    function validate_(areaModification, opts = {}) {
        const viewport = {
            left: 0,
            top: 0,
            width: 10,
            height: 10,
        };

        areaModification = _.defaults(areaModification || {}, {
            left: 0,
            top: 0,
            width: 0,
            height: 0,
        });

        const captureArea = {
            left: areaModification.left,
            top: areaModification.top,
            width: viewport.width + areaModification.width,
            height: viewport.height + areaModification.height,
        };

        const viewportOffset = { top: 0, left: 0 };

        return assertCorrectCaptureAreaBounds("test browser", viewport, viewportOffset, [captureArea], opts);
    }

    describe("validation warnings", () => {
        it("should warn if crop area left boundary is outside of viewport", () => {
            validate_({ left: -1 });

            assert.calledOnceWithMatch(loggerWarnStub, sinon.match("outside of horizontal viewport bounds"));
        });

        it("should not warn if crop area top boundary is outside of viewport", () => {
            validate_({ top: -1 });

            assert.notCalled(loggerWarnStub);
        });

        it("should warn if crop area right boundary is outside of viewport", () => {
            validate_({ width: +1 });

            assert.calledOnceWithMatch(loggerWarnStub, sinon.match("outside of horizontal viewport bounds"));
        });

        it("should warn if crop area height bigger than viewport height", () => {
            validate_({ height: +1 });

            assert.calledOnceWithMatch(loggerWarnStub, sinon.match("larger than viewport height"));
        });
    });

    it('should not throw any errors if option "allowViewportOverflow" is set and "compositeImage" is not', () => {
        const opts = { allowViewportOverflow: true, compositeImage: false };

        validate_({ left: -1, height: +1 }, opts);

        assert.notCalled(loggerWarnStub);
    });

    it("should not throw OffsetViewportError if option allowViewportOverflow is set", () => {
        const opts = { allowViewportOverflow: true };

        validate_({ left: -1 }, opts);

        assert.notCalled(loggerWarnStub);
    });

    it('should not throw if crop area height bigger than viewport height and "compositeImage" is set', () => {
        const opts = { compositeImage: true };

        validate_({ height: +1 }, opts);

        assert.notCalled(loggerWarnStub);
    });

    it("should not throw on passed validation", () => {
        validate_({ left: 0 });

        assert.notCalled(loggerWarnStub);
    });

    describe("comprehensive validation tests", () => {
        it("should not warn for valid bounds", () => {
            const viewportSize = { width: 100, height: 100 };
            const viewportOffset = { left: 0, top: 0 };
            const captureArea = { left: 10, top: 10, width: 50, height: 50 };
            const opts = {};

            assertCorrectCaptureAreaBounds("test capture area", viewportSize, viewportOffset, [captureArea], opts);

            assert.notCalled(loggerWarnStub);
        });

        it("should warn when capture area overflows horizontally", () => {
            const viewportSize = { width: 100, height: 100 };
            const viewportOffset = { left: 0, top: 0 };
            const captureArea = { left: 90, top: 10, width: 50, height: 50 }; // overflows right
            const opts = {};

            assertCorrectCaptureAreaBounds("test capture area", viewportSize, viewportOffset, [captureArea], opts);

            assert.calledOnceWithMatch(loggerWarnStub, sinon.match("outside of horizontal viewport bounds"));
        });

        it("should warn when capture area overflows vertically", () => {
            const viewportSize = { width: 100, height: 100 };
            const viewportOffset = { left: 0, top: 0 };
            const captureArea = { left: 10, top: 90, width: 50, height: 50 }; // overflows bottom
            const opts = {};

            assertCorrectCaptureAreaBounds("test capture area", viewportSize, viewportOffset, [captureArea], opts);

            assert.calledOnceWithMatch(loggerWarnStub, sinon.match("larger than viewport height"));
        });

        it("should not throw when allowViewportOverflow is set and compositeImage is false", () => {
            const viewportSize = { width: 100, height: 100 };
            const viewportOffset = { left: 0, top: 0 };
            const captureArea = { left: 90, top: 10, width: 50, height: 50 }; // would overflow
            const opts = { allowViewportOverflow: true, compositeImage: false };

            assertCorrectCaptureAreaBounds("test capture area", viewportSize, viewportOffset, [captureArea], opts);

            assert.notCalled(loggerWarnStub);
        });

        it("should not throw when compositeImage is true", () => {
            const viewportSize = { width: 100, height: 100 };
            const viewportOffset = { left: 0, top: 0 };
            const captureArea = { left: 10, top: 90, width: 50, height: 50 }; // would overflow vertically
            const opts = { compositeImage: true };

            assertCorrectCaptureAreaBounds("test capture area", viewportSize, viewportOffset, [captureArea], opts);

            assert.notCalled(loggerWarnStub);
        });
    });
});

describe("assertPixelRatio", () => {
    it("should retain the pixel ratio when screenshot dimensions match within rounding", () => {
        assert.doesNotThrow(() =>
            assertPixelRatio({ width: 391, height: 843 }, { width: 390, height: 844 }, { width: 390, height: 844 }),
        );
    });

    for (const estimatedRatio of [1, 4]) {
        it(`should correct a pixel ratio of ${estimatedRatio} using screenshot dimensions`, () => {
            const error = assert.throws(
                () =>
                    assertPixelRatio(
                        { width: 1170, height: 2532 },
                        { width: 390 * estimatedRatio, height: 844 * estimatedRatio },
                        { width: 390, height: 844 },
                    ),
                PixelRatioChangeError,
            );

            assert.equal(error.pixelRatio, 3);
        });
    }

    it("should infer the ratio from CSS dimensions when the estimated viewport was rounded", () => {
        const error = assert.throws(
            () =>
                assertPixelRatio(
                    { width: 780, height: 1688 },
                    { width: 488, height: 1055 },
                    { width: 390, height: 844 },
                ),
            PixelRatioChangeError,
        );

        assert.equal(error.pixelRatio, 2);
    });

    it("should preserve fractional CSS viewport dimensions when inferring the ratio", () => {
        const error = assert.throws(
            () =>
                assertPixelRatio(
                    { width: 781, height: 1689 },
                    { width: 1171.5, height: 2533.5 },
                    { width: 390.5, height: 844.5 },
                ),
            PixelRatioChangeError,
        );

        assert.equal(error.pixelRatio, 2);
    });

    it("should reject dimensions that do not indicate a uniform scale change", () => {
        assert.throws(
            () =>
                assertPixelRatio(
                    { width: 1170, height: 844 },
                    { width: 390, height: 844 },
                    { width: 390, height: 844 },
                ),
            /consistent pixel ratio/,
        );
    });

    for (const [measuredRatio, expectedRatio] of [
        [1.999999, 2],
        [2.000001, 2],
        [1.999, 2],
        [2.001, 2],
        [4.999, 5],
        [5.001, 5],
        [1.9989, 1.9989],
        [2.0011, 2.0011],
        [1.25, 1.25],
        [0.0005, 0.0005],
    ]) {
        it(`should correct an inferred ratio of ${measuredRatio} to ${expectedRatio}`, () => {
            const viewportSizeInCss = { width: 1000 / measuredRatio, height: 2000 / measuredRatio };
            const error = assert.throws(
                () =>
                    assertPixelRatio(
                        { width: 1000, height: 2000 },
                        { width: viewportSizeInCss.width * 3, height: viewportSizeInCss.height * 3 },
                        viewportSizeInCss,
                    ),
                PixelRatioChangeError,
            );

            assert.equal(error.pixelRatio, expectedRatio);
        });
    }
});
