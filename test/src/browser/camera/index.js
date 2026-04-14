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
        image.getSize.resolves({ width: 100500, height: 500100 });
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
                    image.getSize.resolves({ width: 10, height: 10 });

                    camera.calibrate({ top: 6, left: 4, width: 10, height: 10 });
                    await camera.captureViewportImage();

                    assert.calledOnceWith(image.crop, {
                        left: 4,
                        top: 6,
                        width: 10 - 4,
                        height: 10 - 6,
                    });
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
