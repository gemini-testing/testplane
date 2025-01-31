"use strict";

// const {Camera} = require("src/browser/camera");
const {Image} = require("src/image");
const proxyquire = require("proxyquire");
// const utils = require("src/browser/camera/utils");

describe("browser/camera", () => {
    const sandbox = sinon.createSandbox();
    let Camera;
    let isFullPageStub;
    let image;

    beforeEach(() => {
        isFullPageStub = sinon.stub();
        Camera = proxyquire("src/browser/camera", {
            "./utils": {
                isFullPage: isFullPageStub,
            }
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

                    camera.calibrate({ top: 6, left: 4 });
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
                let page;

                const mkCamera_ = browserOptions => {
                    const screenshotMode = (browserOptions || {}).screenshotMode || "auto";
                    return new Camera(screenshotMode, sinon.stub().resolves());
                };

                beforeEach(() => {
                    page = {
                        viewport: {
                            left: 1,
                            top: 1,
                            width: 100,
                            height: 100,
                        },
                    };
                });

                it("should not crop to viewport if page disposition was not passed", async () => {
                    await mkCamera_().captureViewportImage();

                    assert.notCalled(image.crop);
                });

                it("should crop fullPage image with viewport value if page disposition was set", async () => {
                    isFullPageStub.returns(true);

                    await mkCamera_({ screenshotMode: "fullPage" }).captureViewportImage(page);

                    assert.calledOnceWith(image.crop, page.viewport);
                });

                it("should crop not fullPage image to the left and right", async () => {
                    isFullPageStub.returns(false);

                    await mkCamera_({ screenshotMode: "viewport" }).captureViewportImage(page);

                    assert.calledOnceWith(image.crop, {
                        left: 0,
                        top: 0,
                        height: page.viewport.height,
                        width: page.viewport.width,
                    });
                });
            });
        });
    });
});
