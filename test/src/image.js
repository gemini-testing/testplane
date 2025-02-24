"use strict";

const proxyquire = require("proxyquire");

describe("Image", () => {
    const sandbox = sinon.createSandbox();
    let Image;
    let image;
    let looksSameStub;
    let sharpStub;
    let mkSharpInstance;

    const mkSharpStub_ = () => {
        const stub = {};

        stub.metadata = sandbox.stub().resolves({ channels: 3, width: 100500, height: 500100 });
        stub.toBuffer = sandbox
            .stub()
            .resolves({ data: "buffer", info: { channels: 3, width: 100500, height: 500100 } });
        stub.extract = sandbox.stub().returns(stub);
        stub.composite = sandbox.stub().returns(stub);
        stub.resize = sandbox.stub().returns(stub);
        stub.toFile = sandbox.stub().resolves();
        stub.raw = () => stub;
        stub.png = () => stub;

        return stub;
    };

    const transformAreaToClearData_ = ({ top, left, height, width, channels }) => ({
        top,
        left,
        input: {
            create: {
                background: { alpha: 1, b: 0, g: 0, r: 0 },
                channels,
                height,
                width,
            },
        },
    });

    beforeEach(() => {
        looksSameStub = sandbox.stub();
        sharpStub = mkSharpStub_();
        mkSharpInstance = sandbox.stub().callsFake(() => sharpStub);
        Image = proxyquire("src/image", {
            "looks-same": looksSameStub,
            sharp: mkSharpInstance,
        }).Image;

        image = Image.create("imgBuffer");
    });

    afterEach(() => sandbox.restore());

    describe("getSize", () => {
        beforeEach(() => {
            sharpStub.metadata.resolves({ width: 15, height: 12 });
            sharpStub.toBuffer.resolves({ data: "buffer", info: { width: 15, height: 12 } });
        });

        it("should return image size", async () => {
            const size = await image.getSize();

            assert.deepEqual(size, { width: 15, height: 12 });
        });

        it("should return updated image size after composite with another image", async () => {
            image.addJoin(image);
            await image.applyJoin();
            const size = await image.getSize();

            assert.deepEqual(size, { width: 15, height: 12 * 2 });
        });
    });

    describe("crop", () => {
        it("should recreate image instance from buffer after crop", async () => {
            sharpStub.toBuffer.resolves({ data: "croppedBuffer", info: { channels: 3, width: 10, height: 15 } });
            await image.crop({ left: 20, top: 10, width: 40, height: 30 });

            assert.calledTwice(mkSharpInstance);
            assert.calledWithMatch(mkSharpInstance.secondCall, "croppedBuffer", {
                raw: {
                    width: 10,
                    height: 15,
                    channels: 3,
                },
            });
        });

        it("should extract area from image", async () => {
            const area = { left: 20, top: 10, width: 40, height: 30 };

            await image.crop(area);

            assert.calledOnceWith(sharpStub.extract, area);
        });

        it("should consider image sizes", async () => {
            sharpStub.metadata.resolves({ width: 10, height: 10 });

            await image.crop({ left: 3, top: 3, width: 10, height: 10 });

            assert.calledOnceWith(sharpStub.extract, { left: 3, top: 3, width: 7, height: 7 });
        });
    });

    describe("should clear", () => {
        it("a region of an image", async () => {
            sharpStub.metadata.resolves({ channels: 4 });
            const clearArea = { left: 20, top: 10, width: 40, height: 30 };

            await image.addClear(clearArea);
            image.applyClear();

            assert.calledOnceWith(sharpStub.composite, [transformAreaToClearData_({ ...clearArea, channels: 4 })]);
        });

        it("multiple regions of an image", async () => {
            sharpStub.metadata.resolves({ channels: 3 });
            const firstArea = { left: 20, top: 10, width: 40, height: 30 };
            const secondArea = { left: 70, top: 50, width: 200, height: 100 };

            await image.addClear(firstArea);
            await image.addClear(secondArea);
            image.applyClear();

            assert.calledOnceWith(sharpStub.composite, [
                transformAreaToClearData_({ ...firstArea, channels: 3 }),
                transformAreaToClearData_({ ...secondArea, channels: 3 }),
            ]);
        });
    });

    describe("composite images", () => {
        let image2;

        beforeEach(() => {
            sharpStub.toBuffer.resolves({ data: "buf", info: { width: 12, height: 7, channels: 3 } });
            sharpStub.metadata.resolves({ width: 12, height: 7 });

            const sharpStub2 = mkSharpStub_();
            sharpStub2.toBuffer.resolves({ data: "buf2", info: { width: 12, height: 5, channels: 3 } });
            sharpStub2.metadata.resolves({ width: 12, height: 5 });
            mkSharpInstance.withArgs("buf2").returns(sharpStub2);

            image2 = Image.create("buf2");
        });

        it("should resize image before join", async () => {
            image.addJoin(image2);
            await image.applyJoin();

            assert.callOrder(sharpStub.resize, sharpStub.composite);
            assert.calledOnceWith(sharpStub.resize, {
                width: 12,
                height: 7 + 5,
                fit: "contain",
                position: "top",
            });
        });

        it("should composite images with incrementing top offset", async () => {
            image.addJoin(image2);
            image.addJoin(image2);
            await image.applyJoin();

            assert.calledOnce(sharpStub.composite);
            assert.calledWithMatch(sharpStub.composite, [
                { input: "buf2", left: 0, top: 7, raw: { width: 12, height: 5, channels: 3 } },
                { input: "buf2", left: 0, top: 12, raw: { width: 12, height: 5, channels: 3 } },
            ]);
        });

        it("should composite images after resize", async () => {
            image.addJoin(image2);
            await image.applyJoin();

            assert.callOrder(sharpStub.resize, sharpStub.composite);
        });

        it("should update size after join", async () => {
            image.addJoin(image2);
            await image.applyJoin();

            assert.becomes(image.getSize(), { width: 12, height: 7 + 5 });
        });

        it("should not resize image if no images were added to join", async () => {
            const oldSize = await image.getSize();

            await image.applyJoin();
            const newSize = await image.getSize();

            assert.match(newSize, oldSize);
            assert.notCalled(sharpStub.composite);
            assert.notCalled(sharpStub.resize);
        });
    });

    describe("getRGBA", () => {
        beforeEach(() => {
            sharpStub.toBuffer.resolves({
                data: Buffer.from([1, 2, 3, 4, 5, 6]),
                info: {
                    channels: 3,
                    width: 2,
                },
            });
        });

        it("should return RGBA pixel", async () => {
            const pixel = await image.getRGBA(1, 0);

            assert.match(pixel, { r: 4, g: 5, b: 6, a: 1 });
        });

        it('should call "toBuffer" once', async () => {
            await image.getRGBA(0, 1);
            await image.getRGBA(0, 2);

            assert.calledOnce(sharpStub.toBuffer);
        });
    });

    it("should save image", async () => {
        const fileName = "image.png";

        await image.save(fileName);

        assert.calledOnceWith(sharpStub.toFile, fileName);
    });

    it("should create image from base64", () => {
        const base64 = "base64 image";

        Image.fromBase64(base64);

        assert.calledWith(mkSharpInstance, Buffer.from(base64, "base64"));
    });

    describe("toPngBuffer", () => {
        beforeEach(() => {
            sharpStub.toBuffer.resolves({ data: "pngBuffer", info: { width: 15, height: 10, channels: 3 } });
            sharpStub.toBuffer.withArgs({ resolveWithObject: false }).resolves("pngBuffer");
        });

        it("should resolve png buffer with object", async () => {
            const buffObj = await image.toPngBuffer();

            assert.deepEqual(buffObj, { data: "pngBuffer", size: { width: 15, height: 10 } });
        });

        it("should resolve png buffer without object", async () => {
            const buffer = await image.toPngBuffer({ resolveWithObject: false });

            assert.equal(buffer, "pngBuffer");
        });
    });

    it("should compare two images", async () => {
        looksSameStub.resolves();

        await Image.compare("some/path", "other/path", {
            canHaveCaret: true,
            pixelRatio: 11,
            tolerance: 250,
            antialiasingTolerance: 100500,
            compareOpts: { stopOnFirstFail: true },
        });

        assert.calledOnceWith(looksSameStub, "some/path", "other/path", {
            ignoreCaret: true,
            pixelRatio: 11,
            tolerance: 250,
            antialiasingTolerance: 100500,
            stopOnFirstFail: true,
            createDiffImage: true,
        });
    });

    it("should build diff image", async () => {
        const createDiffStub = sinon.stub();
        looksSameStub.createDiff = createDiffStub;
        createDiffStub.resolves();

        await Image.buildDiff({
            reference: 100,
            current: 200,
            diff: 500,
            tolerance: 300,
            diffColor: 400,
        });

        assert.calledOnceWith(createDiffStub, {
            reference: 100,
            current: 200,
            diff: 500,
            tolerance: 300,
            highlightColor: 400,
        });
    });
});
