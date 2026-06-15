"use strict";

const { Image } = require("src/image");
const proxyquire = require("proxyquire");

describe("browser/camera", () => {
    const sandbox = sinon.createSandbox();
    let Camera;
    let isFullPageStub;
    let getIntersectionStub;
    let image;

    beforeEach(() => {
        isFullPageStub = sinon.stub();
        getIntersectionStub = sinon.stub().callsFake((_, area) => area);
        Camera = proxyquire("src/browser/camera", {
            "./utils": {
                isFullPage: isFullPageStub,
                getIntersection: getIntersectionStub,
            },
        }).Camera;

        image = sinon.createStubInstance(Image);
        image.getSize.returns({ width: 100500, height: 500100 });
        image.crop.resolves();

        sandbox.stub(Image, "fromBase64").returns(image);
    });

    afterEach(() => sandbox.restore());

    describe("captureViewportImage", () => {
        it("should take screenshot", () => {
            const takeScreenshot = sinon.stub().resolves({ foo: "bar" });
            const camera = Camera.create(null, takeScreenshot);

            Image.fromBase64.withArgs({ foo: "bar" }).returns(image);

            return assert.becomes(camera.captureViewportImage(), image);
        });

        describe("crop", () => {
            describe("calibration", () => {
                it("should apply calibration on taken screenshot", async () => {
                    const camera = Camera.create(null, sinon.stub().resolves());
                    image.getSize.returns({ width: 10, height: 10 });

                    camera.calibrate({ top: 6, left: 4, width: 10, height: 10 }, { width: 10, height: 10 });
                    await camera.captureViewportImage();

                    assert.calledOnceWith(image.crop, {
                        left: 4,
                        top: 6,
                        width: 10 - 4,
                        height: 10 - 6,
                    });
                });

                it("should not apply calibration when screenshot size differs from calibration screenshot size", async () => {
                    const camera = Camera.create(null, sinon.stub().resolves());
                    image.getSize.returns({ width: 20, height: 20 });

                    camera.calibrate({ top: 6, left: 4, width: 10, height: 10 }, { width: 10, height: 10 });
                    await camera.captureViewportImage();

                    assert.notCalled(image.crop);
                });
            });

            describe("cropMargins", () => {
                it("should crop raw screenshot using user margins", async () => {
                    const camera = Camera.create(null, sinon.stub().resolves());
                    image.getSize.resolves({ width: 20, height: 15 });

                    await camera.captureViewportImage({
                        cropMargins: { top: 1, right: 8, bottom: 2, left: 4 },
                    });

                    assert.calledOnceWith(image.crop, {
                        left: 4,
                        top: 1,
                        width: 8,
                        height: 12,
                    });
                });

                it("should merge calibration and user margins using max value for each side", async () => {
                    const camera = Camera.create(null, sinon.stub().resolves());
                    image.getSize.resolves({ width: 20, height: 20 });

                    camera.calibrate({ top: 2, left: 4, width: 12, height: 16 }, { width: 20, height: 20 });
                    await camera.captureViewportImage({
                        cropMargins: { top: 1, right: 8 },
                    });

                    assert.calledOnceWith(image.crop, {
                        left: 4,
                        top: 2,
                        width: 8,
                        height: 16,
                    });
                });

                it("should throw if margins produce empty crop area", async () => {
                    const camera = Camera.create(null, sinon.stub().resolves());
                    image.getSize.resolves({ width: 20, height: 20 });

                    await assert.isRejected(
                        camera.captureViewportImage({
                            cropMargins: { left: 10, right: 10 },
                        }),
                        /resulting screenshot crop area is empty/,
                    );
                });

                it("should throw if margin is not a non-negative integer", async () => {
                    const camera = Camera.create(null, sinon.stub().resolves());

                    await assert.isRejected(
                        camera.captureViewportImage({
                            cropMargins: { top: 1.5 },
                        }),
                        /Invalid cropMargins\.top option/,
                    );
                });
            });

            describe("crop to viewport", () => {
                let viewportOffset;
                let viewportSize;
                let opts;

                const mkCamera_ = browserOptions => {
                    const screenshotMode = (browserOptions || {}).screenshotMode || "auto";
                    return new Camera(screenshotMode, sinon.stub().resolves());
                };

                beforeEach(() => {
                    viewportOffset = {
                        left: 1,
                        top: 1,
                    };
                    viewportSize = {
                        width: 100,
                        height: 100,
                    };
                    opts = {
                        viewportOffset,
                        viewportSize,
                    };
                });

                it("should not crop to viewport if page disposition was not passed", async () => {
                    await mkCamera_().captureViewportImage();

                    assert.notCalled(image.crop);
                });

                it("should crop fullPage image with viewport value if page disposition was set", async () => {
                    isFullPageStub.returns(true);

                    await mkCamera_({ screenshotMode: "fullpage" }).captureViewportImage(opts);

                    assert.calledOnceWith(image.crop, {
                        ...viewportSize,
                        ...viewportOffset,
                    });
                });

                it("should use viewportOffset for fullPage image crop if provided", async () => {
                    isFullPageStub.returns(true);
                    viewportOffset.top = 10;
                    viewportOffset.left = 20;

                    await mkCamera_({ screenshotMode: "fullpage" }).captureViewportImage(opts);

                    assert.calledOnceWith(image.crop, {
                        top: 10,
                        left: 20,
                        width: viewportSize.width,
                        height: viewportSize.height,
                    });
                });

                it("should not crop not fullPage image", async () => {
                    isFullPageStub.returns(false);

                    await mkCamera_({ screenshotMode: "viewport" }).captureViewportImage(opts);

                    assert.notCalled(image.crop);
                });
            });
        });
    });
});
