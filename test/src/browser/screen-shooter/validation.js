"use strict";

const _ = require("lodash");

const { CoordValidator } = require("src/browser/screen-shooter/validation");
const { VerticalOverflowError } = require("src/browser/screen-shooter/errors/vertical-overflow-error");
const { HorizontalOverflowError } = require("src/browser/screen-shooter/errors/horizontal-overflow-error");

describe("CoordValidator", () => {
    let coordValidator;

    function validate_(areaModification) {
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

        return coordValidator.validate(viewport, captureArea);
    }

    beforeEach(() => {
        coordValidator = new CoordValidator({ id: "some-browser-id" });
    });

    describe("validation failed", () => {
        it("if crop area left boundary is outside of viewport", () => {
            assert.throws(() => validate_({ left: -1 }), HorizontalOverflowError);
        });

        it("if crop area top boundary is outside of viewport", () => {
            assert.throws(() => validate_({ top: -1 }), VerticalOverflowError);
        });

        it("if crop area right boundary is outside of viewport", () => {
            assert.throws(() => validate_({ width: +1 }), HorizontalOverflowError);
        });

        it("if crop area height bigger than viewport height", () => {
            assert.throws(() => validate_({ height: +1 }), VerticalOverflowError);
        });
    });

    it('should not throw any errors if option "allowViewportOverflow" is set and "compositeImage" is not', () => {
        coordValidator = new CoordValidator(
            { id: "some-browser-id" },
            { allowViewportOverflow: true, compositeImage: false },
        );

        assert.doesNotThrow(() => validate_({ left: -1, height: +1 }));
    });

    it("should not throw OffsetViewportError if option allowViewportOverflow is set", () => {
        coordValidator = new CoordValidator({ id: "some-browser-id" }, { allowViewportOverflow: true });

        assert.doesNotThrow(() => validate_({ left: -1 }));
    });

    it('should not throw if crop area height bigger than viewport height and "compositeImage" is set', () => {
        coordValidator = new CoordValidator({ id: "some-browser-id" }, { compositeImage: true });

        assert.doesNotThrow(() => validate_({ height: +1 }));
    });

    it("should not throw on passed validation", () => {
        const fn = () => validate_({ left: 0 });

        return assert.doesNotThrow(fn);
    });
});
