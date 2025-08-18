"use strict";

const proxyquire = require("proxyquire");

describe("Image", () => {
    const sandbox = sinon.createSandbox();
    let Image;
    let looksSameStub;
    let convertRgbaToPngStub;
    let fsStub;
    let loadEsmStub;
    let jsquashDecodeStub;

    const createMockPngBuffer = (width = 100, height = 50) => {
        const buffer = Buffer.alloc(100);
        // Mock PNG header with width and height at correct offsets
        buffer.writeUInt32BE(width, 16); // PNG_WIDTH_OFFSET
        buffer.writeUInt32BE(height, 20); // PNG_HEIGHT_OFFSET
        return buffer;
    };

    const createMockImageData = (width = 100, height = 50) => {
        const dataSize = width * height * 4; // RGBA channels
        return Buffer.alloc(dataSize);
    };

    beforeEach(() => {
        looksSameStub = sandbox.stub();
        looksSameStub.createDiff = sandbox.stub();
        convertRgbaToPngStub = sandbox.stub().returns(Buffer.alloc(0));
        fsStub = {
            promises: {
                readFile: sandbox.stub(),
                writeFile: sandbox.stub().resolves(),
            },
        };
        loadEsmStub = sandbox.stub();
        jsquashDecodeStub = sandbox.stub().resolves({ data: createMockImageData() });

        // Mock the jsquash module loading
        loadEsmStub.withArgs("@jsquash/png/decode.js").resolves({
            init: sandbox.stub().resolves(),
            decode: jsquashDecodeStub,
        });

        Image = proxyquire("src/image", {
            fs: fsStub,
            "looks-same": looksSameStub,
            "load-esm": { loadEsm: loadEsmStub },
            "./utils/eight-bit-rgba-to-png": { convertRgbaToPng: convertRgbaToPngStub },
        }).Image;
    });

    afterEach(() => sandbox.restore());

    describe("constructor", () => {
        it("should read width and height from PNG buffer", () => {
            const buffer = createMockPngBuffer(200, 150);

            const image = new Image(buffer);

            assert.equal(image._width, 200);
            assert.equal(image._height, 150);
        });

        it("should initialize image data promise", () => {
            const buffer = createMockPngBuffer();

            const image = new Image(buffer);

            assert.exists(image._imgDataPromise);
        });

        it("should initialize empty compose images array", () => {
            const buffer = createMockPngBuffer();

            const image = new Image(buffer);

            assert.deepEqual(image._composeImages, []);
        });
    });

    describe("create", () => {
        it("should create new Image instance", () => {
            const buffer = createMockPngBuffer();

            const image = Image.create(buffer);

            assert.instanceOf(image, Image);
        });
    });

    describe("fromBase64", () => {
        it("should create Image from base64 string", () => {
            const base64 = Buffer.from("test").toString("base64");
            sandbox.stub(Buffer, "from").returns(createMockPngBuffer());

            const image = Image.fromBase64(base64);

            assert.instanceOf(image, Image);
            assert.calledWith(Buffer.from, base64, "base64");
        });
    });

    describe("_getImgData", () => {
        it("should return cached image data if available", async () => {
            const buffer = createMockPngBuffer();
            const image = new Image(buffer);
            const mockData = Buffer.from("cached");
            image._imgData = mockData;

            const result = await image._getImgData();

            assert.equal(result, mockData);
        });

        it("should resolve image data promise and cache result", async () => {
            const buffer = createMockPngBuffer();
            const image = new Image(buffer);
            const mockImageData = createMockImageData();
            jsquashDecodeStub.resolves({ data: mockImageData });

            const result = await image._getImgData();

            assert.equal(image._imgData, result);
            assert.instanceOf(result, Buffer);
        });
    });

    describe("_ensureImagesHaveSameWidth", () => {
        it("should not throw if all images have same width", () => {
            const buffer = createMockPngBuffer(100, 50);
            const image = new Image(buffer);
            const attachedImage = new Image(createMockPngBuffer(100, 75));
            image._composeImages = [attachedImage];

            assert.doesNotThrow(() => image._ensureImagesHaveSameWidth());
        });

        it("should throw error if images have different widths", () => {
            const buffer = createMockPngBuffer(100, 50);
            const image = new Image(buffer);
            const attachedImage = new Image(createMockPngBuffer(150, 75));
            image._composeImages = [attachedImage];

            assert.throws(
                () => image._ensureImagesHaveSameWidth(),
                /It looks like viewport width changed while performing long page screenshot \(100px -> 150px\)/,
            );
        });
    });

    describe("getSize", () => {
        it("should return size of single image", async () => {
            const buffer = createMockPngBuffer(100, 50);
            const image = new Image(buffer);

            const size = await image.getSize();

            assert.deepEqual(size, { width: 100, height: 50 });
        });

        it("should return combined height for composed images", async () => {
            const buffer = createMockPngBuffer(100, 50);
            const image = new Image(buffer);
            const attachedImage1 = new Image(createMockPngBuffer(100, 30));
            const attachedImage2 = new Image(createMockPngBuffer(100, 20));
            image._composeImages = [attachedImage1, attachedImage2];

            const size = await image.getSize();

            assert.deepEqual(size, { width: 100, height: 100 }); // 50 + 30 + 20
        });

        it("should ensure images have same width before calculating size", async () => {
            const buffer = createMockPngBuffer(100, 50);
            const image = new Image(buffer);
            sandbox.spy(image, "_ensureImagesHaveSameWidth");

            await image.getSize();

            assert.calledOnce(image._ensureImagesHaveSameWidth);
        });
    });

    describe("crop", () => {
        it("should crop image data according to rect", async () => {
            const buffer = createMockPngBuffer(100, 100);
            const image = new Image(buffer);
            const mockImageData = createMockImageData(100, 100);
            image._imgData = mockImageData;

            const rect = { top: 10, left: 20, width: 50, height: 30 };
            await image.crop(rect);

            assert.equal(image._width, 50);
            assert.equal(image._height, 30);
            assert.instanceOf(image._imgData, Buffer);
        });

        it("should get image data before cropping", async () => {
            const buffer = createMockPngBuffer(100, 100);
            const image = new Image(buffer);
            sandbox.spy(image, "_getImgData");

            const rect = { top: 0, left: 0, width: 50, height: 50 };
            await image.crop(rect);

            assert.calledOnce(image._getImgData);
        });
    });

    describe("addJoin", () => {
        it("should add images to compose array", () => {
            const buffer = createMockPngBuffer();
            const image = new Image(buffer);
            const attachedImages = [new Image(createMockPngBuffer()), new Image(createMockPngBuffer())];

            image.addJoin(attachedImages);

            assert.deepEqual(image._composeImages, attachedImages);
        });

        it("should concatenate with existing compose images", () => {
            const buffer = createMockPngBuffer();
            const image = new Image(buffer);
            const existingImage = new Image(createMockPngBuffer());
            const newImages = [new Image(createMockPngBuffer()), new Image(createMockPngBuffer())];
            image._composeImages = [existingImage];

            image.addJoin(newImages);

            assert.equal(image._composeImages.length, 3);
            assert.equal(image._composeImages[0], existingImage);
        });
    });

    describe("applyJoin", () => {
        it("should return early if no compose images", async () => {
            const buffer = createMockPngBuffer();
            const image = new Image(buffer);
            sandbox.spy(image, "_ensureImagesHaveSameWidth");

            await image.applyJoin();

            assert.notCalled(image._ensureImagesHaveSameWidth);
        });

        it("should ensure images have same width", async () => {
            const buffer = createMockPngBuffer(100, 50);
            const image = new Image(buffer);
            const attachedImage = new Image(createMockPngBuffer(100, 30));
            image._composeImages = [attachedImage];
            sandbox.spy(image, "_ensureImagesHaveSameWidth");

            await image.applyJoin();

            assert.calledOnce(image._ensureImagesHaveSameWidth);
        });

        it("should concatenate image buffers and update height", async () => {
            const buffer = createMockPngBuffer(100, 50);
            const image = new Image(buffer);
            const attachedImage = new Image(createMockPngBuffer(100, 30));
            image._composeImages = [attachedImage];

            const mockData1 = Buffer.from("data1");
            const mockData2 = Buffer.from("data2");
            image._imgData = mockData1;
            attachedImage._imgData = mockData2;

            await image.applyJoin();

            assert.equal(image._height, 80); // 50 + 30
            assert.instanceOf(image._imgData, Buffer);
        });
    });

    describe("clearArea", () => {
        it("should clear specified area with black pixels", async () => {
            const buffer = createMockPngBuffer(100, 100);
            const image = new Image(buffer);
            const mockImageData = createMockImageData(100, 100);
            image._imgData = mockImageData;
            sandbox.spy(mockImageData, "fill");

            const rect = { top: 10, left: 20, width: 50, height: 30 };
            await image.clearArea(rect);

            assert.called(mockImageData.fill);
        });

        it("should get image data before clearing", async () => {
            const buffer = createMockPngBuffer(100, 100);
            const image = new Image(buffer);
            sandbox.spy(image, "_getImgData");

            const rect = { top: 0, left: 0, width: 50, height: 50 };
            await image.clearArea(rect);

            assert.calledOnce(image._getImgData);
        });
    });

    describe("getRGB", () => {
        it("should return RGB values for specified coordinates", async () => {
            const buffer = createMockPngBuffer(100, 100);
            const image = new Image(buffer);
            const mockImageData = Buffer.alloc(100 * 100 * 4);
            // Set some test RGB values at position (10, 5)
            const idx = (100 * 5 + 10) * 4;
            mockImageData[idx] = 255; // R
            mockImageData[idx + 1] = 128; // G
            mockImageData[idx + 2] = 64; // B
            image._imgData = mockImageData;

            const rgb = await image.getRGB(10, 5);

            assert.deepEqual(rgb, { R: 255, G: 128, B: 64 });
        });

        it("should get image data before reading RGB", async () => {
            const buffer = createMockPngBuffer(100, 100);
            const image = new Image(buffer);
            sandbox.spy(image, "_getImgData");

            await image.getRGB(0, 0);

            assert.calledOnce(image._getImgData);
        });
    });

    describe("_getPngBuffer", () => {
        it("should convert image data to PNG buffer", async () => {
            const buffer = createMockPngBuffer(100, 50);
            const image = new Image(buffer);
            const mockImageData = createMockImageData(100, 50);
            image._imgData = mockImageData;
            const expectedPngBuffer = Buffer.from("png-data");
            convertRgbaToPngStub.returns(expectedPngBuffer);

            const result = await image._getPngBuffer();

            assert.calledWith(convertRgbaToPngStub, mockImageData, 100, 50);
            assert.equal(result, expectedPngBuffer);
        });
    });

    describe("save", () => {
        it("should save PNG buffer to file", async () => {
            const buffer = createMockPngBuffer();
            const image = new Image(buffer);
            const mockPngBuffer = Buffer.from("png-data");
            sandbox.stub(image, "_getPngBuffer").resolves(mockPngBuffer);

            await image.save("test.png");

            assert.calledWith(fsStub.promises.writeFile, "test.png", mockPngBuffer);
        });
    });

    describe("toPngBuffer", () => {
        it("should return PNG buffer when resolveWithObject is false", async () => {
            const buffer = createMockPngBuffer(100, 50);
            const image = new Image(buffer);
            const mockPngBuffer = Buffer.from("png-data");
            sandbox.stub(image, "_getPngBuffer").resolves(mockPngBuffer);

            const result = await image.toPngBuffer({ resolveWithObject: false });

            assert.equal(result, mockPngBuffer);
        });

        it("should return object with data and size when resolveWithObject is true", async () => {
            const buffer = createMockPngBuffer(100, 50);
            const image = new Image(buffer);
            const mockPngBuffer = Buffer.from("png-data");
            sandbox.stub(image, "_getPngBuffer").resolves(mockPngBuffer);

            const result = await image.toPngBuffer({ resolveWithObject: true });

            assert.deepEqual(result, {
                data: mockPngBuffer,
                size: { width: 100, height: 50 },
            });
        });

        it("should default to resolveWithObject: true", async () => {
            const buffer = createMockPngBuffer(100, 50);
            const image = new Image(buffer);
            const mockPngBuffer = Buffer.from("png-data");
            sandbox.stub(image, "_getPngBuffer").resolves(mockPngBuffer);

            const result = await image.toPngBuffer();

            assert.isObject(result);
            assert.property(result, "data");
            assert.property(result, "size");
        });
    });

    describe("compare", () => {
        it("should call looksSame with correct parameters", async () => {
            const expectedResult = { equal: true };
            looksSameStub.resolves(expectedResult);

            const result = await Image.compare("path1.png", "path2.png", {
                canHaveCaret: true,
                pixelRatio: 4,
            });

            assert.calledWith(looksSameStub, "path1.png", "path2.png", {
                createDiffImage: true,
                ignoreCaret: true,
                pixelRatio: 4,
            });
            assert.equal(result, expectedResult);
        });

        it("should pass compare options to looksSame", async () => {
            const opts = {
                canHaveCaret: true,
                pixelRatio: 2,
                tolerance: 5,
                antialiasingTolerance: 3,
                compareOpts: { strict: true },
            };

            await Image.compare("path1.png", "path2.png", opts);

            assert.calledWith(looksSameStub, "path1.png", "path2.png", {
                ignoreCaret: true,
                pixelRatio: 2,
                tolerance: 5,
                antialiasingTolerance: 3,
                strict: true,
                createDiffImage: true,
            });
        });

        it("should not set tolerance if not provided", async () => {
            await Image.compare("path1.png", "path2.png", {});

            const callArgs = looksSameStub.getCall(0).args[2];
            assert.notProperty(callArgs, "tolerance");
        });

        it("should not set antialiasingTolerance if not provided", async () => {
            await Image.compare("path1.png", "path2.png", {});

            const callArgs = looksSameStub.getCall(0).args[2];
            assert.notProperty(callArgs, "antialiasingTolerance");
        });
    });

    describe("buildDiff", () => {
        it("should call looksSame.createDiff with correct options", async () => {
            const opts = {
                diffColor: "#ff0000",
                reference: "ref.png",
                current: "current.png",
                diff: "diff.png",
            };
            looksSameStub.createDiff.resolves(null);

            const result = await Image.buildDiff(opts);

            assert.calledWith(looksSameStub.createDiff, {
                highlightColor: "#ff0000",
                reference: "ref.png",
                current: "current.png",
                diff: "diff.png",
            });
            assert.isNull(result);
        });

        it("should rename diffColor to highlightColor", async () => {
            const opts = { diffColor: "#00ff00" };
            looksSameStub.createDiff.resolves(null);

            await Image.buildDiff(opts);

            const callArgs = looksSameStub.createDiff.getCall(0).args[0];
            assert.equal(callArgs.highlightColor, "#00ff00");
            assert.notProperty(callArgs, "diffColor");
        });
    });
});
