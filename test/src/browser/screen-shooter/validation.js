"use strict";

const _ = require("lodash");
const proxyquire = require("proxyquire");

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
