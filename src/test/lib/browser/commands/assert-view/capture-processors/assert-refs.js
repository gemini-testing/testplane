"use strict";

const _ = require("lodash");
const { handleImageDiff } = require("lib/browser/commands/assert-view/capture-processors/assert-refs");
const ImageDiffError = require("lib/browser/commands/assert-view/errors/image-diff-error");

describe("browser/commands/assert-view/capture-processors/assert-refs", () => {
    const sandbox = sinon.createSandbox();

    beforeEach(() => {
        sandbox.stub(ImageDiffError, "create");
    });

    afterEach(() => sandbox.restore());

    describe("handleImageDiff", () => {
        const mkConfig_ = (opts = {}) => {
            return _.defaultsDeep(opts, {
                buildDiffOpts: {},
                system: { diffColor: "default-color" },
            });
        };

        const handleImageDiff_ = (opts = {}) => {
            const { currImg, refImg, state, diffOpts } = _.defaultsDeep(opts, {
                currImg: { path: "/default-curr/path" },
                refImg: { path: "/default-ref/path" },
                state: "default-state",
                diffOpts: {
                    tolerance: opts.tolerance,
                    antialiasingTolerance: opts.antialiasingTolerance,
                    canHaveCaret: opts.canHaveCaret,
                    diffAreas: opts.diffAreas,
                    config: mkConfig_(opts.config),
                },
            });

            return handleImageDiff(currImg, refImg, state, diffOpts);
        };

        describe('should create instace of "ImageDiffError" with', () => {
            it('diff options from "buildDiffOpts"', async () => {
                const config = {
                    buildDiffOpts: { foo: "bar", baz: "qux" },
                };

                await handleImageDiff_({ config })
                    .catch(() => {
                        assert.calledOnceWith(
                            ImageDiffError.create,
                            sinon.match.any, sinon.match.any, sinon.match.any,
                            sinon.match({ foo: "bar", baz: "qux" }),
                        );
                    });
            });

            ["tolerance", "antialiasingTolerance"].forEach((option) => {
                it(`"${option}" option`, async () => {
                    await handleImageDiff_({ [option]: 1 })
                        .catch(() => {
                            assert.calledOnceWith(
                                ImageDiffError.create,
                                sinon.match.any, sinon.match.any, sinon.match.any,
                                sinon.match({ [option]: 1 }),
                            );
                        });
                });

                it(`overridden "${option}" option from "buildDiffOpts"`, async () => {
                    const config = {
                        buildDiffOpts: { [option]: 1 },
                    };

                    await handleImageDiff_({ [option]: 2, config })
                        .catch(() => {
                            assert.calledOnceWith(
                                ImageDiffError.create,
                                sinon.match.any, sinon.match.any, sinon.match.any,
                                sinon.match({ [option]: 1 }),
                            );
                        });
                });
            });

            describe("not ignore caret if", () => {
                it("none of the editable elements are in focus", async () => {
                    const config = {
                        buildDiffOpts: { ignoreCaret: true },
                    };

                    await handleImageDiff_({ config, canHaveCaret: false })
                        .catch(() => {
                            assert.calledOnceWith(
                                ImageDiffError.create,
                                sinon.match.any, sinon.match.any, sinon.match.any,
                                sinon.match({ ignoreCaret: false }),
                            );
                        });
                });

                it("in config is explicitly set not to ignore it", async () => {
                    const config = {
                        buildDiffOpts: { ignoreCaret: false },
                    };

                    await handleImageDiff_({ config, canHaveCaret: true })
                        .catch(() => {
                            assert.calledOnceWith(
                                ImageDiffError.create,
                                sinon.match.any, sinon.match.any, sinon.match.any,
                                sinon.match({ ignoreCaret: false }),
                            );
                        });
                });
            });

            it("ignore caret if one of the editable elements are in focus", async () => {
                const config = {
                    buildDiffOpts: { ignoreCaret: true },
                };

                await handleImageDiff_({ config, canHaveCaret: true })
                    .catch(() => {
                        assert.calledOnceWith(
                            ImageDiffError.create,
                            sinon.match.any, sinon.match.any, sinon.match.any,
                            sinon.match({ ignoreCaret: true }),
                        );
                    });
            });
        });
    });
});
