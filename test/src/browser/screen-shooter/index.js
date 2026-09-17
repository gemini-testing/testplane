"use strict";

const { Image } = require("src/image");
const ScreenShooter = require("src/browser/screen-shooter");
const Viewport = require("src/browser/screen-shooter/viewport");

describe("screen-shooter", () => {
    const sandbox = sinon.createSandbox();

    beforeEach(() => {
        sandbox.spy(Viewport, "create");
        sandbox.stub(Viewport.prototype, "ignoreAreas");
        sandbox.stub(Viewport.prototype, "composite");
        sandbox.stub(Viewport.prototype, "handleImage");
        sandbox.stub(Viewport.prototype, "extendBy");
        sandbox.stub(Viewport.prototype, "validate");
    });

    afterEach(() => sandbox.restore());

    describe("capture", () => {
        let browser;
        const imageStub = sinon.createStubInstance(Image);

        const stubPage = page => Object.assign({ viewport: {}, captureArea: {}, ignoreAreas: [], pixelRatio: 1 }, page);
        const capture = (page, opts) => ScreenShooter.create(browser).capture(stubPage(page), opts);

        beforeEach(() => {
            imageStub.uncroppedSize = { width: 300, height: 600 };
            browser = {
                config: {},
                captureViewportImage: sandbox.stub().resolves(imageStub),
                evalScript: sandbox.stub().resolves(1),
                scrollBy: sandbox.stub().resolves(),
            };
        });

        it("should take vieport image", async () => {
            await capture({ viewport: "foo", captureArea: "bar" });

            assert.calledOnceWith(browser.captureViewportImage, sinon.match({ viewport: "foo", captureArea: "bar" }));
        });

        it("should process image with Viewport.handleImage", async () => {
            await capture({ viewport: "foo", captureArea: "bar" });

            assert.calledOnceWith(Viewport.prototype.handleImage, imageStub);
        });

        describe("should create Viewport instance", () => {
            it("with viewport page", async () => {
                await capture({ viewport: "foo" });

                assert.calledOnceWith(Viewport.create, {
                    captureArea: {},
                    ignoreAreas: [],
                    pixelRatio: 1,
                    viewport: "foo",
                });
            });

            it("with viewport image", async () => {
                await capture();

                assert.calledOnceWith(Viewport.create, sinon.match.any, imageStub);
            });

            it("with pixelRatio data", async () => {
                await capture({ pixelRatio: 100500 });

                assert.calledOnceWith(Viewport.create, {
                    captureArea: {},
                    ignoreAreas: [],
                    pixelRatio: 100500,
                    viewport: {},
                });
            });

            ["allowViewportOverflow", "compositeImage"].forEach(option => {
                it(`with passed "${option}" option`, async () => {
                    await capture({}, { [option]: true });

                    assert.calledOnceWith(
                        Viewport.create,
                        sinon.match.any,
                        sinon.match.any,
                        sinon.match({ [option]: true }),
                    );
                });
            });
        });

        it("should pass screenshotDelay from options to captureViewportImage", async () => {
            await capture(stubPage(), { screenshotDelay: 2000 });

            assert.calledWithMatch(browser.captureViewportImage, sinon.match.any, 2000);
        });

        it("should retry using the screenshot pixel ratio even if the browser reports another value", async () => {
            const preparedPage = {
                captureArea: { left: 3, top: 6, width: 30, height: 60 },
                viewport: { left: 0, top: 0, width: 300, height: 600 },
                viewportSizeInCss: { width: 100, height: 200 },
                ignoreAreas: [{ left: 9, top: 12, width: 15, height: 18 }],
                documentHeight: 900,
                documentWidth: 600,
                pixelRatio: 3,
            };
            const reprepareScreenshot = sandbox.stub().resolves(preparedPage);
            const opts = { reprepareScreenshot };

            await capture(
                {
                    captureArea: { left: 1, top: 2, width: 10, height: 20 },
                    viewport: { left: 0, top: 0, width: 100, height: 200 },
                    viewportSizeInCss: { width: 100, height: 200 },
                    ignoreAreas: [{ left: 3, top: 4, width: 5, height: 6 }],
                    documentHeight: 300,
                    documentWidth: 200,
                    pixelRatio: 1,
                },
                opts,
            );

            assert.calledTwice(browser.captureViewportImage);
            assert.notCalled(browser.evalScript);
            assert.calledOnceWith(reprepareScreenshot, 3);
            assert.calledOnceWith(Viewport.create, preparedPage, imageStub, sinon.match.any);
            assert.notProperty(opts, "preferredPixelRatio");
            assert.notProperty(opts, "reprepareScreenshot");
        });

        it("should recompute fractional-DPR geometry instead of rescaling rounded bounds", async () => {
            const preparedPage = {
                captureArea: { left: 1, top: 2, width: 10, height: 20 },
                viewport: { left: 50, top: 0, width: 101, height: 201 },
                viewportSizeInCss: { width: 101, height: 201 },
                ignoreAreas: [{ left: 3, top: 4, width: 6, height: 7 }],
                documentHeight: 201,
                documentWidth: 101,
                pixelRatio: 1,
            };
            const reprepareScreenshot = sandbox.stub().resolves(preparedPage);
            const opts = { preferredPixelRatio: 2.625, reprepareScreenshot };
            imageStub.uncroppedSize = { width: 101, height: 201 };

            await capture(
                {
                    captureArea: { left: 3, top: 6, width: 28, height: 54 },
                    viewport: { left: 131, top: 0, width: 266, height: 528 },
                    viewportSizeInCss: { width: 101, height: 201 },
                    ignoreAreas: [{ left: 9, top: 12, width: 15, height: 18 }],
                    documentHeight: 528,
                    documentWidth: 266,
                    pixelRatio: 2.625,
                },
                opts,
            );

            assert.calledOnceWith(reprepareScreenshot, 1);
            assert.calledOnceWith(Viewport.create, preparedPage, imageStub, sinon.match.any);
        });

        it("should retain the capabilities estimate without a browser round trip when the image matches", async () => {
            const reprepareScreenshot = sandbox.stub();

            await capture(
                { viewport: { width: 300, height: 600 }, pixelRatio: 3 },
                { preferredPixelRatio: 3, reprepareScreenshot },
            );

            assert.calledOnce(browser.captureViewportImage);
            assert.notCalled(browser.evalScript);
            assert.notCalled(reprepareScreenshot);
        });

        it("should allow a one-pixel rounding difference in screenshot dimensions", async () => {
            const reprepareScreenshot = sandbox.stub();

            await capture({ viewport: { width: 301, height: 599 }, pixelRatio: 3 }, { reprepareScreenshot });

            assert.notCalled(reprepareScreenshot);
        });

        it("should finish the retry in best-effort mode if the screenshot scale changes again", async () => {
            const reprepareScreenshot = sandbox.stub().resolves({
                viewport: { width: 300, height: 600 },
                pixelRatio: 3,
            });
            const secondImage = sinon.createStubInstance(Image);
            secondImage.uncroppedSize = { width: 200, height: 400 };
            browser.captureViewportImage.onSecondCall().resolves(secondImage);

            await capture(
                { viewport: { width: 100, height: 200 }, viewportSizeInCss: { width: 100, height: 200 } },
                { reprepareScreenshot },
            );

            assert.calledOnceWith(reprepareScreenshot, 3);
            assert.calledTwice(browser.captureViewportImage);
            assert.calledOnceWith(Viewport.prototype.handleImage, secondImage);
        });

        it("should reject screenshot dimensions that do not indicate a uniform scale", async () => {
            imageStub.uncroppedSize = { width: 300, height: 800 };
            const reprepareScreenshot = sandbox.stub();

            await assert.isRejected(
                capture(
                    { viewport: { width: 100, height: 200 }, viewportSizeInCss: { width: 100, height: 200 } },
                    { reprepareScreenshot },
                ),
                "Screenshot dimensions do not match the viewport at a consistent pixel ratio",
            );

            assert.notCalled(reprepareScreenshot);
        });

        [
            [1.999999, 2],
            [2.000001, 2],
            [1.999, 2],
            [2.001, 2],
            [4.999, 5],
            [5.001, 5],
            [1.9989, 1.9989],
            [2.0011, 2.0011],
            [1.75, 1.75],
            [0.0005, 0.0005],
        ].forEach(([actual, expected]) => {
            it(`should infer screenshot pixel ratio ${actual} as ${expected}`, async () => {
                imageStub.uncroppedSize = { width: actual * 1000000, height: actual * 2000000 };
                const reprepareScreenshot = sandbox.stub().resolves({ pixelRatio: expected });

                await capture(
                    {
                        viewport: { width: 1000000, height: 2000000 },
                        viewportSizeInCss: { width: 1000000, height: 2000000 },
                    },
                    { reprepareScreenshot },
                );

                assert.calledOnceWith(reprepareScreenshot, expected);
            });
        });

        it("should extract image of passed size", async () => {
            await capture({ captureArea: { foo: "bar" } });

            assert.calledOnceWith(Viewport.prototype.composite);
        });

        it("should return composited image", () => {
            Viewport.prototype.composite.resolves({ foo: "bar" });

            return assert.becomes(capture(), { foo: "bar" });
        });

        describe("if validation fails", () => {
            describe("with NOT `HeightViewportError`", () => {
                it("should not extract image", () => {
                    return capture({ captureArea: { top: -1 } }).catch(() =>
                        assert.notCalled(Viewport.prototype.extract),
                    );
                });
            });

            describe("with `HeightViewportError`", () => {
                it('should not crop image if "compositeImage" is switched off', async () => {
                    try {
                        await capture(
                            { captureArea: { height: 7 }, viewport: { top: 0, height: 5 } },
                            { compositeImage: false },
                        );
                    } catch (err) {
                        assert.notCalled(Viewport.prototype.crop);
                    }
                });

                describe('option "compositeImage" is switched on', () => {
                    beforeEach(() => {
                        Viewport.prototype.validate.onFirstCall().returns(true).onSecondCall().returns(false);
                    });

                    it("should scroll vertically if capture area is higher than viewport", async () => {
                        const page = { captureArea: { top: 0, height: 7 }, viewport: { top: 0, height: 5 } };

                        await capture(page, { compositeImage: true });

                        assert.calledOnceWith(browser.scrollBy, { x: 0, y: 2, selector: undefined });
                    });

                    it('should scroll vertically relative to the passed "selectorToScroll" option', async () => {
                        const page = { captureArea: { top: 0, height: 7 }, viewport: { top: 0, height: 5 } };

                        await capture(page, { compositeImage: true, selectorToScroll: ".some-elem" });

                        assert.calledOnceWith(browser.scrollBy, { x: 0, y: 2, selector: ".some-elem" });
                    });

                    it("should scroll vertically until the end of capture area", async () => {
                        const page = { captureArea: { top: 0, height: 11 }, viewport: { top: 0, height: 5 } };
                        Viewport.prototype.validate
                            .onFirstCall()
                            .returns(true)
                            .onSecondCall()
                            .returns(true)
                            .onThirdCall()
                            .returns(false);
                        sandbox
                            .stub(Viewport.prototype, "getVerticalOverflow")
                            .onFirstCall()
                            .returns(6)
                            .onSecondCall()
                            .returns(1);

                        await capture(page, { compositeImage: true });

                        assert.calledTwice(browser.scrollBy);
                        assert.calledWith(browser.scrollBy, { x: 0, y: 5, selector: undefined });
                        assert.calledWith(browser.scrollBy, { x: 0, y: 1, selector: undefined });
                    });

                    it("should capture scrolled viewport image", async () => {
                        const page = { captureArea: { top: 0, height: 7 }, viewport: { top: 0, height: 5 } };

                        await capture(page, { compositeImage: true });

                        assert.calledWithMatch(browser.captureViewportImage, { viewport: { top: 2 } });
                    });

                    // Test does not fairly check that `captureViewportImage` was called after resolving of `scrollBy`
                    it("should capture viewport image after scroll", async () => {
                        const page = { captureArea: { top: 0, height: 7 }, viewport: { top: 0, height: 5 } };
                        const scrolledPage = {
                            captureArea: { top: 0, height: 7 },
                            viewport: { top: 2, height: 5 },
                            ignoreAreas: [],
                            pixelRatio: 1,
                        };
                        const captureViewportImage = browser.captureViewportImage
                            .withArgs(scrolledPage)
                            .named("captureViewportImage");
                        const scroll = browser.scrollBy.withArgs({ x: 0, y: 2, selector: undefined }).named("scroll");

                        await capture(page, { compositeImage: true });

                        assert.callOrder(scroll, captureViewportImage);
                    });

                    it("should extend original image by scrolled viewport image", async () => {
                        const page = { captureArea: { top: 0, height: 7 }, viewport: { top: 0, height: 5 } };
                        const scrolledPage = { captureArea: { top: 0, height: 7 }, viewport: { top: 2, height: 5 } };
                        const scrolledViewportScreenshot = imageStub;
                        browser.captureViewportImage
                            .withArgs(scrolledPage)
                            .returns(Promise.resolve(scrolledViewportScreenshot));

                        await capture(page, { compositeImage: true });

                        assert.calledOnceWith(Viewport.prototype.extendBy, 2, scrolledViewportScreenshot);
                    });

                    it("should return composed image", () => {
                        Viewport.prototype.composite.resolves("foo bar");

                        return assert.becomes(capture(), "foo bar");
                    });
                });
            });
        });
    });
});
