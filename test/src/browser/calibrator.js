"use strict";

const path = require("path");
const fs = require("fs");
const proxyquire = require("proxyquire");
const timers = require("node:timers/promises");
const { Image } = require("src/image");
const { CoreError } = require("src/browser/core-error");

describe("calibrator", () => {
    let browser, calibrator, logger;

    const mkBrowser = () => {
        return {
            open: () => {},
            evalScript: () => {},
            captureViewportImage: () => {},
        };
    };

    const setScreenshot = imageName => {
        const imgPath = path.join(__dirname, "..", "..", "fixtures", imageName);
        const imgData = fs.readFileSync(imgPath);
        const image = new Image(imgData);

        browser.captureViewportImage.returns(Promise.resolve(image));

        return image;
    };

    const mkBlankImage = () => {
        const image = sinon.createStubInstance(Image);
        image.getSize.returns({ width: 10, height: 10 });
        image.getRGB.resolves({ R: 255, G: 255, B: 255 });
        image.save.resolves();
        return image;
    };

    afterEach(() => sinon.restore());

    beforeEach(() => {
        browser = mkBrowser();

        sinon.stub(browser);
        sinon.stub(timers, "setTimeout").resolves();
        logger = { error: sinon.stub() };
        browser.evalScript.returns(Promise.resolve({ innerWidth: 984 })); // width of viewport in test image
        browser.open.returns(Promise.resolve());

        const { Calibrator } = proxyquire("src/browser/calibrator", { "../utils/logger": logger });
        calibrator = new Calibrator();
    });

    [
        { data: { innerWidth: 984 }, name: "wd" },
        { data: { value: { innerWidth: 984 } }, name: "webdriverio" },
    ].forEach(({ data, name }) => {
        it(`should calculate correct crop area for ${name}`, async () => {
            setScreenshot("calibrate.png");
            browser.evalScript.returns(Promise.resolve(data));

            const result = await calibrator.calibrate(browser);

            assert.match(result.top, 2);
            assert.match(result.left, 2);
        });
    });

    it("should return also features detected by script", async () => {
        setScreenshot("calibrate.png");
        browser.evalScript.returns(Promise.resolve({ feature: "value", innerWidth: 984 }));

        const result = await calibrator.calibrate(browser);

        assert.match(result.feature, "value");
    });

    it("should not perform the calibration process two times", async () => {
        setScreenshot("calibrate.png");

        await calibrator.calibrate(browser);
        await calibrator.calibrate(browser);

        assert.calledOnce(browser.open);
        assert.calledOnce(browser.evalScript);
        assert.calledOnce(browser.captureViewportImage);
        assert.notCalled(timers.setTimeout);
    });

    it("should return cached result second time", async () => {
        setScreenshot("calibrate.png");

        const result = await calibrator.calibrate(browser);

        await calibrator.calibrate(browser);

        assert.match(result.top, 2);
        assert.match(result.left, 2);
    });

    [false, true].forEach(hasICCPChunk => {
        it(`should retry a blank screenshot until the marker appears (iCCP: ${hasICCPChunk})`, async () => {
            setScreenshot("calibrate.png");
            const blankImage = mkBlankImage();
            blankImage._hasICCPChunk = hasICCPChunk;
            browser.captureViewportImage.onFirstCall().resolves(blankImage);

            const result = await calibrator.calibrate(browser);

            assert.calledTwice(browser.captureViewportImage);
            assert.calledOnceWithExactly(timers.setTimeout, 100);
            assert.callOrder(browser.captureViewportImage, timers.setTimeout);
            assert.calledOnce(browser.open);
            assert.calledOnce(browser.evalScript);
            assert.notCalled(blankImage.save);
            assert.equal(result.top, 2);
            assert.equal(result.left, 2);
        });
    });

    it("should stop after 10 attempts and save the last screenshot", async () => {
        const firstImage = mkBlankImage();
        const lastImage = mkBlankImage();
        browser.captureViewportImage.resolves(firstImage);
        browser.captureViewportImage.onCall(9).resolves(lastImage);

        await assert.isRejected(calibrator.calibrate(browser), CoreError);

        assert.callCount(browser.captureViewportImage, 10);
        assert.callCount(timers.setTimeout, 9);
        assert.alwaysCalledWithExactly(timers.setTimeout, 100);
        assert.notCalled(firstImage.save);
        assert.calledWith(lastImage.save, path.join(require("os").tmpdir(), "testplane-calibration-page.png"));
        assert.calledOnce(logger.error);
    });

    it("should fail on broken calibration page", async () => {
        setScreenshot("calibrate-broken.png");

        await assert.isRejected(calibrator.calibrate(browser), CoreError);
    });

    describe("when image has iCCP chunk", () => {
        it("should use color at the center of the image to detect marker", async () => {
            const image = setScreenshot("calibrate.png");
            const { width, height } = image.getSize();
            const centerX = Math.floor(width / 2);
            const centerY = Math.floor(height / 2);
            const centerColor = { R: 174, G: 248, B: 77 };
            const markerLeft = 7;
            const markerTop = 4;

            image._hasICCPChunk = true;

            sinon.stub(image, "getRGB").callsFake(async (x, y) => {
                if (x === centerX && y === centerY) {
                    return centerColor;
                }

                if (x === markerLeft && y === markerTop) {
                    return centerColor;
                }

                return { R: 0, G: 0, B: 0 };
            });

            const result = await calibrator.calibrate(browser);

            assert.equal(result.top, markerTop);
            assert.equal(result.left, markerLeft);
        });
    });

    describe("when image does not have iCCP chunk", () => {
        it("should use hardcoded green color as search color", async () => {
            const image = setScreenshot("calibrate.png");
            const { width, height } = image.getSize();
            const centerX = Math.floor(width / 2);
            const centerY = Math.floor(height / 2);
            sinon.stub(image, "getRGB").callsFake(async (x, y) => {
                if ((x === 3 && y === 5) || (x === centerX && y === centerY)) {
                    return { R: 148, G: 250, B: 0 };
                }

                return { R: 0, G: 0, B: 0 };
            });

            const result = await calibrator.calibrate(browser);

            assert.equal(result.top, 5);
            assert.equal(result.left, 3);
        });
    });
});
