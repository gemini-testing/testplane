"use strict";

const { Image } = require("src/image");
const { CompositeImage } = require("src/browser/screen-shooter/composite-image");

describe("CompositeImage", () => {
    const sandbox = sinon.createSandbox();
    let image;

    const createCompositeImage = (opts = {}) => {
        const captureArea = opts.captureArea || { left: 0, top: 0, width: 100, height: 100 };
        const safeArea = opts.safeArea || { left: 0, top: 0, width: 100, height: 100 };
        const ignoreAreas = opts.ignoreAreas || [];

        return CompositeImage.create(captureArea, safeArea, ignoreAreas);
    };

    const createMockImage = (overrides = {}) => {
        const mockImage = sandbox.createStubInstance(Image);
        mockImage.getSize.resolves({ width: 100, height: 100 });
        mockImage.toPngBuffer.resolves(Buffer.from("mock-buffer"));
        mockImage.crop.resolves();
        mockImage.addClear.resolves();
        mockImage.addJoin.returns();
        mockImage.applyJoin.resolves();

        Object.keys(overrides).forEach(key => {
            if (typeof overrides[key] === "function") {
                mockImage[key] = overrides[key];
            } else {
                mockImage[key].resolves(overrides[key]);
            }
        });

        return mockImage;
    };

    beforeEach(() => {
        image = createMockImage();
    });

    afterEach(() => sandbox.restore());

    describe("hasNotCapturedArea", () => {
        it("should return true when no images have been registered", () => {
            const compositeImage = createCompositeImage({
                captureArea: { left: 0, top: 0, width: 100, height: 200 },
            });

            assert.isTrue(compositeImage.hasNotCapturedArea());
        });

        it("should return true when captured height is less than capture area height", async () => {
            const compositeImage = createCompositeImage({
                captureArea: { left: 0, top: 0, width: 100, height: 200 },
            });

            image.getSize.resolves({ width: 100, height: 50 });
            await compositeImage.registerViewportImageAtOffset(image, { left: 0, top: 0 }, { left: 0, top: 0 });

            assert.isTrue(compositeImage.hasNotCapturedArea());
        });

        it("should return false when captured height equals capture area height", async () => {
            const compositeImage = createCompositeImage({
                captureArea: { left: 0, top: 0, width: 100, height: 100 },
            });

            image.getSize.resolves({ width: 100, height: 100 });
            await compositeImage.registerViewportImageAtOffset(image, { left: 0, top: 0 }, { left: 0, top: 0 });

            assert.isFalse(compositeImage.hasNotCapturedArea());
        });

        it("should return false when captured height exceeds capture area height", async () => {
            const compositeImage = createCompositeImage({
                captureArea: { left: 0, top: 0, width: 100, height: 100 },
            });

            image.getSize.resolves({ width: 100, height: 150 });
            await compositeImage.registerViewportImageAtOffset(image, { left: 0, top: 0 }, { left: 0, top: 0 });

            assert.isFalse(compositeImage.hasNotCapturedArea());
        });

        it("should handle multiple chunks correctly", async () => {
            const compositeImage = createCompositeImage({
                captureArea: { left: 0, top: 0, width: 100, height: 200 },
            });

            image.getSize.resolves({ width: 100, height: 80 });

            await compositeImage.registerViewportImageAtOffset(image, { left: 0, top: 0 }, { left: 0, top: 0 });

            const secondImage = createMockImage({ getSize: { width: 100, height: 80 } });
            await compositeImage.registerViewportImageAtOffset(secondImage, { left: 0, top: 80 }, { left: 0, top: 0 });

            const thirdImage = createMockImage({ getSize: { width: 100, height: 80 } });
            await compositeImage.registerViewportImageAtOffset(thirdImage, { left: 0, top: 160 }, { left: 0, top: 0 });

            assert.isFalse(compositeImage.hasNotCapturedArea());
        });
    });

    describe("getNextNotCapturedArea", () => {
        it("should return the full capture area when no images registered", () => {
            const captureArea = { left: 10, top: 20, width: 100, height: 200 };
            const compositeImage = createCompositeImage({ captureArea });

            const nextArea = compositeImage.getNextNotCapturedArea();

            assert.deepEqual(nextArea, captureArea);
        });

        it("should return remaining area after partial capture", async () => {
            const captureArea = { left: 10, top: 20, width: 100, height: 200 };
            const compositeImage = createCompositeImage({ captureArea });

            image.getSize.resolves({ width: 100, height: 80 });
            await compositeImage.registerViewportImageAtOffset(image, { left: 0, top: 0 }, { left: 0, top: 0 });

            const nextArea = compositeImage.getNextNotCapturedArea();

            assert.deepEqual(nextArea, {
                left: 10,
                top: 100, // 20 + 80
                width: 100,
                height: 120, // 200 - 80
            });
        });

        it("should return null when fully captured", async () => {
            const captureArea = { left: 10, top: 20, width: 100, height: 200 };
            const compositeImage = createCompositeImage({ captureArea });

            image.getSize.resolves({ width: 100, height: 200 });
            await compositeImage.registerViewportImageAtOffset(image, { left: 0, top: 0 }, { left: 0, top: 0 });

            const nextArea = compositeImage.getNextNotCapturedArea();

            assert.isNull(nextArea);
        });

        it("should return null when over-captured", async () => {
            const captureArea = { left: 10, top: 20, width: 100, height: 200 };
            const compositeImage = createCompositeImage({ captureArea });

            image.getSize.resolves({ width: 100, height: 250 });
            await compositeImage.registerViewportImageAtOffset(image, { left: 0, top: 0 }, { left: 0, top: 0 });

            const nextArea = compositeImage.getNextNotCapturedArea();

            assert.isNull(nextArea);
        });
    });

    describe("registerViewportImageAtOffset", () => {
        beforeEach(() => {
            image.getSize.resolves({ width: 100, height: 100 });
            image.toPngBuffer.resolves(Buffer.from("test-buffer"));
        });

        it("should register viewport image with basic parameters", async () => {
            const compositeImage = createCompositeImage({
                captureArea: { left: 0, top: 0, width: 100, height: 100 },
                safeArea: { left: 0, top: 0, width: 100, height: 100 },
            });

            await compositeImage.registerViewportImageAtOffset(image, { left: 0, top: 0 }, { left: 0, top: 0 });

            assert.calledOnce(image.toPngBuffer);
            assert.calledWith(image.toPngBuffer, { resolveWithObject: false });
            assert.calledOnce(image.crop);
            assert.calledOnce(image.getSize);
        });

        it("should handle scroll and viewport offsets correctly", async () => {
            const compositeImage = createCompositeImage({
                captureArea: { left: 50, top: 100, width: 200, height: 150 },
                safeArea: { left: 10, top: 20, width: 180, height: 120 },
            });

            await compositeImage.registerViewportImageAtOffset(image, { left: 30, top: 40 }, { left: 10, top: 20 });

            assert.calledOnce(image.crop);
            const cropArgs = image.crop.getCall(0).args[0];
            assert.isObject(cropArgs);
            assert.hasAllKeys(cropArgs, ["left", "top", "width", "height"]);
        });

        it("should expand crop area at the beginning when safe area cuts off the head", async () => {
            const compositeImage = createCompositeImage({
                captureArea: { left: 0, top: 0, width: 100, height: 200 },
                safeArea: { left: 0, top: 50, width: 100, height: 100 },
            });

            await compositeImage.registerViewportImageAtOffset(image, { left: 0, top: 0 }, { left: 0, top: 0 });

            assert.calledOnce(image.crop);
            const cropArgs = image.crop.getCall(0).args[0];
            assert.equal(cropArgs.top, 0);
        });

        it("should handle edge case where safe area and not captured area don't intersect", async () => {
            const compositeImage = createCompositeImage({
                captureArea: { left: 0, top: 0, width: 100, height: 100 },
                safeArea: { left: 200, top: 200, width: 50, height: 50 },
            });

            await compositeImage.registerViewportImageAtOffset(image, { left: 0, top: 0 }, { left: 0, top: 0 });

            assert.calledOnce(image.crop);
            const cropArgs = image.crop.getCall(0).args[0];
            assert.equal(cropArgs.width, 0);
            assert.equal(cropArgs.height, 0);
        });

        it("should store image chunk with correct size after cropping", async () => {
            const compositeImage = createCompositeImage();
            image.getSize.resolves({ width: 80, height: 60 });

            await compositeImage.registerViewportImageAtOffset(image, { left: 0, top: 0 }, { left: 0, top: 0 });

            assert.isTrue(compositeImage.hasNotCapturedArea()); // Since 60 < 100 height
        });
    });

    describe("render", () => {
        it("should throw error when no images have been registered", async () => {
            const compositeImage = createCompositeImage();

            await assert.isRejected(
                compositeImage.render(),
                /Cannot render composite image: last viewport image buffer, container offset or window offset is not set/,
            );
        });
    });

    describe("integration scenarios", () => {
        it("should handle complete workflow from registration to capture state", async () => {
            const compositeImage = createCompositeImage({
                captureArea: { left: 0, top: 0, width: 100, height: 200 },
                safeArea: { left: 0, top: 0, width: 100, height: 100 },
                ignoreAreas: [{ left: 20, top: 30, width: 40, height: 50 }],
            });

            await compositeImage.registerViewportImageAtOffset(image, { left: 0, top: 0 }, { left: 0, top: 0 });

            assert.isTrue(compositeImage.hasNotCapturedArea());

            const secondImage = createMockImage({
                getSize: () => Promise.resolve({ width: 100, height: 100 }),
            });
            await compositeImage.registerViewportImageAtOffset(secondImage, { left: 0, top: 100 }, { left: 0, top: 0 });

            assert.isFalse(compositeImage.hasNotCapturedArea());
        });

        it("should handle edge case with zero-sized areas", async () => {
            const compositeImage = createCompositeImage({
                captureArea: { left: 0, top: 0, width: 0, height: 0 },
                safeArea: { left: 0, top: 0, width: 0, height: 0 },
            });

            assert.isFalse(compositeImage.hasNotCapturedArea());
            assert.isNull(compositeImage.getNextNotCapturedArea());
        });

        it("should handle very large capture areas", async () => {
            const compositeImage = createCompositeImage({
                captureArea: { left: 0, top: 0, width: 10000, height: 10000 },
                safeArea: { left: 0, top: 0, width: 1000, height: 1000 },
            });

            await compositeImage.registerViewportImageAtOffset(image, { left: 0, top: 0 }, { left: 0, top: 0 });

            assert.isTrue(compositeImage.hasNotCapturedArea());

            const nextArea = compositeImage.getNextNotCapturedArea();
            assert.equal(nextArea.height, 9900); // 10000 - 100
        });
    });
});
