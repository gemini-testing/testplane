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
    });

    it("should return cached result second time", async () => {
        setScreenshot("calibrate.png");

        const result = await calibrator.calibrate(browser);

        await calibrator.calibrate(browser);

        assert.match(result.top, 2);
        assert.match(result.left, 2);
    });

    it("should fail on broken calibration page", () => {
        setScreenshot("calibrate-broken.png");

        return assert.isRejected(calibrator.calibrate(browser), CoreError);
    });

    describe("when image has iCCP chunk", () => {
        it("should use color at the center of the image to detect marker", async () => {
            const image = setScreenshot("calibrate.png");
            const { width, height } = image.getSize();
            const centerX = Math.floor(width / 2);
            const centerY = Math.floor(height / 2);
            const centerColor = { R: 50, G: 100, B: 150 };
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
            sinon.stub(image, "getRGB").callsFake(async (x, y) => {
                if (x === 3 && y === 5) {
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
