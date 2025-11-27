"use strict";

const _ = require("lodash");

const { assertCorrectCaptureAreaBounds } = require("src/browser/screen-shooter/validation");
const { VerticalOverflowError } = require("src/browser/screen-shooter/errors/vertical-overflow-error");
const { HorizontalOverflowError } = require("src/browser/screen-shooter/errors/horizontal-overflow-error");

describe("assertCorrectCaptureAreaBounds", () => {
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

        return assertCorrectCaptureAreaBounds("test browser", viewport, viewportOffset, captureArea, opts);
    }

    describe("validation failed", () => {
        it("if crop area left boundary is outside of viewport", () => {
            assert.throws(() => validate_({ left: -1 }), HorizontalOverflowError);
        });

        it("if crop area top boundary is outside of viewport", () => {
            // Note: The current implementation checks top < 0 in the horizontal overflow check
            assert.throws(() => validate_({ top: -1 }), HorizontalOverflowError);
        });

        it("if crop area right boundary is outside of viewport", () => {
            assert.throws(() => validate_({ width: +1 }), HorizontalOverflowError);
        });

        it("if crop area height bigger than viewport height", () => {
            assert.throws(() => validate_({ height: +1 }), VerticalOverflowError);
        });
    });

    it('should not throw any errors if option "allowViewportOverflow" is set and "compositeImage" is not', () => {
        const opts = { allowViewportOverflow: true, compositeImage: false };

        assert.doesNotThrow(() => validate_({ left: -1, height: +1 }, opts));
    });

    it("should not throw OffsetViewportError if option allowViewportOverflow is set", () => {
        const opts = { allowViewportOverflow: true };

        assert.doesNotThrow(() => validate_({ left: -1 }, opts));
    });

    it('should not throw if crop area height bigger than viewport height and "compositeImage" is set', () => {
        const opts = { compositeImage: true };

        assert.doesNotThrow(() => validate_({ height: +1 }, opts));
    });

    it("should not throw on passed validation", () => {
        const fn = () => validate_({ left: 0 });

        return assert.doesNotThrow(fn);
    });

    describe("comprehensive validation tests", () => {
        it("should not throw for valid bounds", () => {
            const viewportSize = { width: 100, height: 100 };
            const viewportOffset = { left: 0, top: 0 };
            const captureArea = { left: 10, top: 10, width: 50, height: 50 };
            const opts = {};

            assert.doesNotThrow(() => {
                assertCorrectCaptureAreaBounds("test capture area", viewportSize, viewportOffset, captureArea, opts);
            });
        });

        it("should throw HorizontalOverflowError when capture area overflows horizontally", () => {
            const viewportSize = { width: 100, height: 100 };
            const viewportOffset = { left: 0, top: 0 };
            const captureArea = { left: 90, top: 10, width: 50, height: 50 }; // overflows right
            const opts = {};

            assert.throws(() => {
                assertCorrectCaptureAreaBounds("test capture area", viewportSize, viewportOffset, captureArea, opts);
            }, HorizontalOverflowError);
        });

        it("should throw VerticalOverflowError when capture area overflows vertically", () => {
            const viewportSize = { width: 100, height: 100 };
            const viewportOffset = { left: 0, top: 0 };
            const captureArea = { left: 10, top: 90, width: 50, height: 50 }; // overflows bottom
            const opts = {};

            assert.throws(() => {
                assertCorrectCaptureAreaBounds("test capture area", viewportSize, viewportOffset, captureArea, opts);
            }, VerticalOverflowError);
        });

        it("should not throw when allowViewportOverflow is set and compositeImage is false", () => {
            const viewportSize = { width: 100, height: 100 };
            const viewportOffset = { left: 0, top: 0 };
            const captureArea = { left: 90, top: 10, width: 50, height: 50 }; // would overflow
            const opts = { allowViewportOverflow: true, compositeImage: false };

            assert.doesNotThrow(() => {
                assertCorrectCaptureAreaBounds("test capture area", viewportSize, viewportOffset, captureArea, opts);
            });
        });

        it("should not throw when compositeImage is true", () => {
            const viewportSize = { width: 100, height: 100 };
            const viewportOffset = { left: 0, top: 0 };
            const captureArea = { left: 10, top: 90, width: 50, height: 50 }; // would overflow vertically
            const opts = { compositeImage: true };

            assert.doesNotThrow(() => {
                assertCorrectCaptureAreaBounds("test capture area", viewportSize, viewportOffset, captureArea, opts);
            });
        });
    });
});
