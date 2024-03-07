"use strict";

const _ = require("lodash");
const { BaseStateError } = require("src/browser/commands/assert-view/errors/base-state-error");
const { ImageDiffError } = require("src/browser/commands/assert-view/errors/image-diff-error");
const Image = require("src/image");

const mkImageDiffError = (opts = {}) => {
    const { stateName, currImg, refImg, diffOpts } = _.defaults(opts, {
        stateName: "default-name",
        currImg: { path: "/default-curr/path" },
        refImg: { path: "/default-ref/path" },
        diffOpts: { foo: "bar" },
    });

    return new ImageDiffError({ stateName, currImg, refImg, diffOpts });
};

describe("ImageDiffError", () => {
    const sandbox = sinon.createSandbox();

    beforeEach(() => {
        sandbox.stub(Image, "buildDiff").resolves();
    });

    afterEach(() => sandbox.restore());

    it('should be an instance of "BaseStateError"', () => {
        assert.instanceOf(mkImageDiffError(), BaseStateError);
    });

    it("should be eventually an instance of Error", () => {
        assert.instanceOf(mkImageDiffError(), Error);
    });

    it("should contain a state name in an error message", () => {
        const error = mkImageDiffError({ stateName: "plain" });

        assert.match(error.message, /images are different for "plain" state/);
    });

    it("should contain a state name", () => {
        const error = mkImageDiffError({ stateName: "plain" });

        assert.equal(error.stateName, "plain");
    });

    it("should contain a current image", () => {
        const error = mkImageDiffError({ currImg: { path: "/curr/path" } });

        assert.deepEqual(error.currImg, { path: "/curr/path" });
    });

    it("should contain a reference image", () => {
        const error = mkImageDiffError({ refImg: { path: "/ref/path" } });

        assert.deepEqual(error.refImg, { path: "/ref/path" });
    });

    it("should contain options for image diff building", () => {
        const error = mkImageDiffError({ diffOpts: { some: "opts" } });

        assert.deepEqual(error.diffOpts, { some: "opts" });
    });

    it("should create an instance of error from object", () => {
        const error = ImageDiffError.fromObject({
            stateName: "name",
            currImg: { path: "curr/path" },
            refImg: { path: "ref/path" },
            diffOpts: { foo: "bar" },
        });

        assert.instanceOf(error, ImageDiffError);
        assert.deepInclude(Object.assign({}, error), {
            stateName: "name",
            currImg: { path: "curr/path" },
            refImg: { path: "ref/path" },
            diffOpts: { foo: "bar" },
        });
    });

    it("should provide the ability to save diff image", () => {
        const error = mkImageDiffError({ diffOpts: { some: "opts" } });

        Image.buildDiff.withArgs({ some: "opts", diff: "diff/path" }).resolves({ foo: "bar" });

        return assert.becomes(error.saveDiffTo("diff/path"), { foo: "bar" });
    });
});
