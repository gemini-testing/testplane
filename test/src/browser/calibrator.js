"use strict";

const path = require("path");
const fs = require("fs");
const timers = require("node:timers/promises");
const { Image } = require("src/image");
const { Calibrator } = require("src/browser/calibrator");
const { CoreError } = require("src/browser/core-error");

describe("calibrator", () => {
    let browser, calibrator;

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
        browser.evalScript.returns(Promise.resolve({ innerWidth: 984 })); // width of viewport in test image
        browser.open.returns(Promise.resolve());

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

            assert.match(result.viewportArea.top, 2);
            assert.match(result.viewportArea.left, 2);
        });
    });

    it("should return also features detected by script", async () => {
        setScreenshot("calibrate.png");
        browser.evalScript.returns(Promise.resolve({ feature: "value", innerWidth: 984 }));

        const result = await calibrator.calibrate(browser);

        assert.match(result.feature, "value");
        assert.isAbove(result.screenshotSize.width, 0);
        assert.isAbove(result.screenshotSize.height, 0);
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

        const cachedResult = await calibrator.calibrate(browser);

        assert.equal(cachedResult, result);
        assert.match(result.viewportArea.top, 2);
        assert.match(result.viewportArea.left, 2);
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
            assert.equal(result.viewportArea.top, 2);
            assert.equal(result.viewportArea.left, 2);
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
    });

    it("should fail on broken calibration page", async () => {
        setScreenshot("calibrate-broken.png");

        await assert.isRejected(calibrator.calibrate(browser), CoreError);
    });

    describe("when image has iCCP chunk", () => {
        it("should ignore an overlay scrollbar when detecting the marker area", async () => {
            const image = setScreenshot("calibrate-with-overlay-scrollbar.png");

            // The fixture was captured from an iCCP-backed browser screenshot, but Image.save() strips the chunk.
            image._hasICCPChunk = true;
            browser.evalScript.returns(Promise.resolve({ innerWidth: 375, pixelRatio: 2, needsCompatLib: false }));

            const result = await calibrator.calibrate(browser);

            assert.deepEqual(result.viewportArea, {
                top: 0,
                left: 0,
                width: 750,
                height: 1616,
            });
        });

        it("should use the color at the center of the image as the marker search color", async () => {
            const image = setScreenshot("calibrate.png");
            // Color profile shifts the rendered marker color away from the hardcoded green
            const markerColor = { R: 174, G: 248, B: 77 };
            const markerLeft = 1;
            const markerTop = 4;
            const markerRight = 9;
            const markerBottom = 6;

            image._hasICCPChunk = true;

            sinon.stub(image, "getSize").returns({ width: 10, height: 10 });
            sinon.stub(image, "getRGB").callsFake(async (x, y) => {
                const insideMarker = x >= markerLeft && x <= markerRight && y >= markerTop && y <= markerBottom;

                return insideMarker ? markerColor : { R: 0, G: 0, B: 0 };
            });

            const result = await calibrator.calibrate(browser);

            // The center pixel (5, 5) lies inside the marker, so its (shifted) color is used to find the marker
            assert.calledWith(image.getRGB, 5, 5);
            assert.equal(result.viewportArea.top, markerTop);
            assert.equal(result.viewportArea.left, markerLeft);
        });
    });

    describe("when image does not have iCCP chunk", () => {
        it("should use the hardcoded green color as the marker search color", async () => {
            const image = setScreenshot("calibrate.png");
            const greenColor = { R: 148, G: 250, B: 0 };
            const markerLeft = 1;
            const markerTop = 5;
            const markerRight = 9;
            const markerBottom = 6;

            image._hasICCPChunk = false;

            sinon.stub(image, "getSize").returns({ width: 10, height: 10 });
            sinon.stub(image, "getRGB").callsFake(async (x, y) => {
                const insideMarker = x >= markerLeft && x <= markerRight && y >= markerTop && y <= markerBottom;

                return insideMarker ? greenColor : { R: 0, G: 0, B: 0 };
            });

            const result = await calibrator.calibrate(browser);

            assert.equal(result.viewportArea.top, markerTop);
            assert.equal(result.viewportArea.left, markerLeft);
        });
    });
});
