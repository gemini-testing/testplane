"use strict";

const path = require("path");
const fs = require("fs");
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

    beforeEach(() => {
        browser = mkBrowser();

        sinon.stub(browser);
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
    });

    it("should return cached result second time", async () => {
        setScreenshot("calibrate.png");

        const result = await calibrator.calibrate(browser);

        const cachedResult = await calibrator.calibrate(browser);

        assert.equal(cachedResult, result);
        assert.match(result.viewportArea.top, 2);
        assert.match(result.viewportArea.left, 2);
    });

    it("should fail on broken calibration page", () => {
        setScreenshot("calibrate-broken.png");

        return assert.isRejected(calibrator.calibrate(browser), CoreError);
    });

    describe("when image has iCCP chunk", () => {
        it("should use the color at the center of the image as the marker search color", async () => {
            const image = setScreenshot("calibrate.png");
            // Color profile shifts the rendered marker color away from the hardcoded green
            const markerColor = { R: 50, G: 100, B: 150 };
            const markerLeft = 4;
            const markerTop = 4;
            const markerRight = 6;
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
            const markerLeft = 3;
            const markerTop = 5;
            const markerRight = 6;
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
