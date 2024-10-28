"use strict";

const { EventEmitter } = require("events");
const _ = require("lodash");
const fs = require("fs-extra");
const webdriverio = require("webdriverio");
const clientBridge = require("src/browser/client-bridge");
const Image = require("src/image");
const ScreenShooter = require("src/browser/screen-shooter");
const temp = require("src/temp");
const validator = require("png-validator");
const { AssertViewError } = require("src/browser/commands/assert-view/errors/assert-view-error");
const { ImageDiffError } = require("src/browser/commands/assert-view/errors/image-diff-error");
const { NoRefImageError } = require("src/browser/commands/assert-view/errors/no-ref-image-error");
const RuntimeConfig = require("src/config/runtime-config");
const updateRefs = require("src/browser/commands/assert-view/capture-processors/update-refs");
const { mkExistingBrowser_: mkBrowser_, mkSessionStub_ } = require("../../utils");
const { InvalidRefImageError } = require("src/browser/commands/assert-view/errors/invalid-ref-image-error");

describe("assertView command", () => {
    const sandbox = sinon.createSandbox();

    const assertViewBrowser = async (browser, state = "plain", selector = ".selector", opts = {}) => {
        return browser.publicAPI.assertView(state, selector, opts);
    };

    const assertViewElement = async (browser, state = "plain", selector = ".selector", opts = {}) => {
        const element = await browser.publicAPI.$(selector);
        return element.assertView(state, opts);
    };

    const mkConfig_ = (opts = {}) => {
        return Object.assign(
            {
                getScreenshotPath: () => "/some/path",
                system: {
                    diffColor: "#ffffff",
                    tempOpts: {},
                },
            },
            opts,
        );
    };

    const stubImage_ = (opts = {}) => {
        opts = _.defaults(opts, {
            size: { width: 100500, height: 500100 },
        });

        return {
            toPngBuffer: sandbox.stub().resolves("defaultPngBuffer"),
            save: sandbox.stub().named("save"),
            getSize: sandbox.stub().named("getSize").returns(opts.size),
        };
    };

    const stubBrowser_ = config => {
        sandbox.stub(clientBridge, "build").resolves();

        const browser = mkBrowser_(config);
        sandbox.stub(browser, "prepareScreenshot").resolves({});
        sandbox.stub(browser, "captureViewportImage").resolves(stubImage_());
        sandbox.stub(browser, "emitter").get(() => new EventEmitter());

        return browser;
    };

    const initBrowser_ = ({ browser = stubBrowser_(), session = mkSessionStub_() } = {}) => {
        session.executionContext = { testplaneCtx: {}, ctx: {} };
        sandbox.stub(webdriverio, "attach").resolves(session);

        return browser.init({ sessionId: session.sessionId, sessionCaps: session.capabilities });
    };

    beforeEach(() => {
        sandbox.stub(Image, "create").returns(Object.create(Image.prototype));
        sandbox.stub(Image, "compare").resolves({ diffImage: { createBuffer: sandbox.stub() } });
        sandbox.stub(Image.prototype, "getSize");

        sandbox.stub(fs, "readFileSync");
        sandbox.stub(validator, "pngValidator").returns(true);
        sandbox.stub(fs, "readFile");
        sandbox.stub(fs, "existsSync").returns(true);
        sandbox.stub(fs, "outputFile").resolves();

        sandbox.stub(temp, "path");
        sandbox.stub(temp, "attach");

        sandbox.stub(RuntimeConfig, "getInstance").returns({ tempOpts: {} });

        sandbox.spy(ScreenShooter, "create");
        sandbox.stub(ScreenShooter.prototype, "capture").resolves(stubImage_());

        sandbox.stub(updateRefs, "handleNoRefImage").resolves();
        sandbox.stub(updateRefs, "handleImageDiff").resolves();

        sandbox.stub(process, "cwd").returns("/ref/cwd");
    });

    afterEach(() => sandbox.restore());

    it("should save InvalidRefImageError to assertViewResults", async () => {
        const constructorStub = sandbox.stub().returns(Object.create(InvalidRefImageError.prototype));
        sandbox.stub(InvalidRefImageError, "constructor").callsFake(constructorStub);

        fs.readFile.withArgs("/ref/invalid").resolves("invalidPngBuffer");
        validator.pngValidator.withArgs("invalidPngBuffer").throws();
        const browser = await initBrowser_({ browser: stubBrowser_({ getScreenshotPath: () => "/ref/invalid" }) });

        await browser.publicAPI.assertView("plain", ".selector");

        const [error] = browser.publicAPI.executionContext.testplaneCtx.assertViewResults.get();
        assert.instanceOf(error, InvalidRefImageError);
        assert.equal(error.stateName, "plain");
        assert.equal(error.refImg.path, "/ref/invalid");
    });

    it("should wait for all selectors to exist", async () => {
        const browser = await initBrowser_();
        const element = await browser.publicAPI.$(".selector");

        await browser.publicAPI.assertView("plain", [".selector1", ".selector2"]);

        assert.calledWith(browser.publicAPI.$, ".selector1");
        assert.calledWith(browser.publicAPI.$, ".selector2");
        assert.calledTwice(element.waitForExist);
    });

    it("should wait for element to exist", async () => {
        const browser = await initBrowser_();
        const element = await browser.publicAPI.$(".selector");

        await element.assertView("plain");

        assert.calledOnce(element.waitForExist);
    });

    it("should fail on duplicate name of the state on mixed scopes", async () => {
        const browser = await initBrowser_();

        await browser.publicAPI.assertView("plain");

        try {
            const elem = await browser.publicAPI.$(".selector");
            await elem.assertView("plain");
        } catch (e) {
            assert.instanceOf(e, AssertViewError);
            assert.equal(e.message, 'duplicate name for "plain" state');
        }
    });

    it("should prepare screenshot for several selectors on browser scope", async () => {
        const browser = await initBrowser_();

        await browser.publicAPI.assertView("plain", [".selector1", ".selector2"]);

        assert.calledOnceWith(browser.prepareScreenshot, [".selector1", ".selector2"]);
    });

    it("should screenshot the viewport if selector is not provided", async () => {
        const browser = await initBrowser_();

        await browser.publicAPI.assertView("plain");

        assert.calledOnceWith(
            browser.prepareScreenshot,
            ["body"],
            sinon.match({
                allowViewportOverflow: true,
                captureElementFromTop: false,
            }),
        );
    });

    it("should add custom options if selector is not provided", async () => {
        const browser = await initBrowser_();

        await browser.publicAPI.assertView("plain", {
            disableAnimation: false,
        });

        assert.calledOnceWith(
            browser.prepareScreenshot,
            ["body"],
            sinon.match({
                allowViewportOverflow: true,
                captureElementFromTop: false,
                disableAnimation: false,
            }),
        );
    });

    [
        { scope: "browser", fn: assertViewBrowser },
        { scope: "element", fn: assertViewElement },
    ].forEach(({ scope, fn }) => {
        describe(`${scope} scope`, () => {
            describe("prepare screenshot", () => {
                it("should fail on duplicate name of the state", async () => {
                    const browser = await initBrowser_();

                    await browser.publicAPI.assertView("plain");

                    try {
                        const elem = await browser.publicAPI.$(".selector");
                        await elem.assertView("plain");
                    } catch (e) {
                        assert.instanceOf(e, AssertViewError);
                        assert.equal(e.message, 'duplicate name for "plain" state');
                    }
                });

                it("should prepare screenshot for one selector", async () => {
                    const browser = await initBrowser_();

                    await fn(browser, "plain", ".selector");

                    assert.calledOnceWith(browser.prepareScreenshot, [".selector"]);
                });

                describe("should prepare screenshot with ignore elements", () => {
                    [
                        {
                            name: "array",
                            ignoreElements: [".foo", "#bar"],
                            ignoreSelectors: [".foo", "#bar"],
                        },
                        {
                            name: "string",
                            ignoreElements: ".foo .bar",
                            ignoreSelectors: [".foo .bar"],
                        },
                    ].forEach(({ name, ignoreElements, ignoreSelectors }) => {
                        it(`passed as ${name} using "assertView" options`, async () => {
                            const browser = await initBrowser_();

                            await fn(browser, null, null, { ignoreElements });

                            assert.calledOnceWith(
                                browser.prepareScreenshot,
                                sinon.match.any,
                                sinon.match({ ignoreSelectors }),
                            );
                        });
                    });

                    it('from config option "assertViewOpts"', async () => {
                        const config = mkConfig_({ assertViewOpts: { ignoreElements: ["foo", "bar"] } });
                        const browser = await initBrowser_({ browser: stubBrowser_(config) });

                        await fn(browser);

                        assert.calledOnceWith(
                            browser.prepareScreenshot,
                            sinon.match.any,
                            sinon.match({ ignoreSelectors: ["foo", "bar"] }),
                        );
                    });

                    it('from "assertView" even if it is set in "assertViewOpts"', async () => {
                        const config = mkConfig_({ assertViewOpts: { ignoreElements: ["foo", "bar"] } });
                        const browser = await initBrowser_({ browser: stubBrowser_(config) });

                        await fn(browser, null, null, { ignoreElements: ["baz", "qux"] });

                        assert.calledOnceWith(
                            browser.prepareScreenshot,
                            sinon.match.any,
                            sinon.match({ ignoreSelectors: ["baz", "qux"] }),
                        );
                    });
                });

                ["allowViewportOverflow", "captureElementFromTop"].forEach(option => {
                    describe(`should prepare screenshot with "${option}" option`, () => {
                        let browser;

                        beforeEach(async () => {
                            const config = mkConfig_({ assertViewOpts: { [option]: false } });
                            browser = await initBrowser_({ browser: stubBrowser_(config) });
                        });

                        it('from config option "assertViewOpts"', async () => {
                            await fn(browser);

                            assert.calledOnceWith(
                                browser.prepareScreenshot,
                                sinon.match.any,
                                sinon.match({ [option]: false }),
                            );
                        });

                        it('from "assertView" command even if it is set in "assertViewOpts"', async () => {
                            await fn(browser, null, "selector", { [option]: true });

                            assert.calledOnceWith(
                                browser.prepareScreenshot,
                                sinon.match.any,
                                sinon.match({ [option]: true }),
                            );
                        });
                    });
                });

                describe('should prepare screenshot with "selectorToScroll" option', () => {
                    let browser;

                    beforeEach(async () => {
                        const config = mkConfig_({ assertViewOpts: { selectorToScroll: ".selector-1" } });
                        browser = await initBrowser_({ browser: stubBrowser_(config) });
                    });

                    it('from config option "assertViewOpts"', async () => {
                        await fn(browser);

                        assert.calledOnceWith(
                            browser.prepareScreenshot,
                            sinon.match.any,
                            sinon.match({ selectorToScroll: ".selector-1" }),
                        );
                    });

                    it('from "assertView" command even if it is set in "assertViewOpts"', async () => {
                        await fn(browser, null, null, { selectorToScroll: ".selector-2" });

                        assert.calledOnceWith(
                            browser.prepareScreenshot,
                            sinon.match.any,
                            sinon.match({ selectorToScroll: ".selector-2" }),
                        );
                    });
                });
            });

            describe("take screenshot", () => {
                it("should create an instance of a screen shooter", async () => {
                    const browser = await initBrowser_();

                    assert.calledOnceWith(ScreenShooter.create, browser);
                });

                it("should capture a screenshot image", async () => {
                    const browser = await initBrowser_();
                    browser.prepareScreenshot.resolves({ foo: "bar" });

                    await fn(browser);

                    assert.calledOnceWith(ScreenShooter.prototype.capture, { foo: "bar" });
                });

                it("should save a captured screenshot", async () => {
                    temp.path.returns("/curr/path");

                    const browser = await initBrowser_();
                    const image = stubImage_();

                    ScreenShooter.prototype.capture.resolves(image);
                    image.toPngBuffer.resolves("currPngBuffer");

                    await fn(browser);

                    assert.calledOnceWith(fs.outputFile, "/curr/path", "currPngBuffer");
                });

                [
                    { option: "allowViewportOverflow", configValue: false, passedValue: true },
                    { option: "selectorToScroll", configValue: ".selector-1", passedValue: ".selector-2" },
                ].forEach(({ option, configValue, passedValue }) => {
                    describe(`should capture screenshot with "${option}" option`, () => {
                        let browser;

                        beforeEach(async () => {
                            const config = mkConfig_({ assertViewOpts: { [option]: configValue } });
                            browser = await initBrowser_({ browser: stubBrowser_(config) });
                        });

                        it('from config option "assertViewOpts"', async () => {
                            await fn(browser);

                            assert.calledWithMatch(ScreenShooter.prototype.capture, sinon.match.any, {
                                [option]: configValue,
                            });
                        });

                        it('from "assertView" command even if it is set in "assertViewOpts"', async () => {
                            await fn(browser, null, null, { [option]: passedValue });

                            assert.calledWithMatch(ScreenShooter.prototype.capture, sinon.match.any, {
                                [option]: passedValue,
                            });
                        });
                    });
                });

                ["compositeImage", "screenshotDelay"].forEach(option => {
                    describe(`should capture screenshot with "${option}" option`, () => {
                        it(`from config option "${option}"`, async () => {
                            const config = mkConfig_({ [option]: "value-1" });
                            const browser = await initBrowser_({ browser: stubBrowser_(config) });

                            await fn(browser);

                            assert.calledWithMatch(ScreenShooter.prototype.capture, sinon.match.any, {
                                [option]: "value-1",
                            });
                        });

                        it(`from config option "assertViewOpts" even if it is set in "${option}"`, async () => {
                            const config = mkConfig_({
                                [option]: "value-1",
                                assertViewOpts: {
                                    [option]: "value-2",
                                },
                            });
                            const browser = await initBrowser_({ browser: stubBrowser_(config) });

                            await fn(browser);

                            assert.calledWithMatch(ScreenShooter.prototype.capture, sinon.match.any, {
                                [option]: "value-2",
                            });
                        });

                        it(`from "assertView" command even if it is set in "assertViewOpts" and "${option}"`, async () => {
                            const config = mkConfig_({
                                [option]: "value-1",
                                assertViewOpts: {
                                    [option]: "value-2",
                                },
                            });
                            const browser = await initBrowser_({ browser: stubBrowser_(config) });

                            await fn(browser, null, "selector", { [option]: "value-3" });

                            assert.calledWithMatch(ScreenShooter.prototype.capture, sinon.match.any, {
                                [option]: "value-3",
                            });
                        });
                    });
                });
            });

            it("should not save current image if reference is already exists", async () => {
                const browser = await initBrowser_({ browser: stubBrowser_({ getScreenshotPath: () => "/ref/path" }) });
                const image = stubImage_();
                fs.existsSync.withArgs("/ref/path").returns(true);
                ScreenShooter.prototype.capture.resolves(image);

                await fn(browser);

                assert.notCalled(image.save);
            });

            it("should save current image if reference does not exist", async () => {
                const browser = await initBrowser_({ browser: stubBrowser_({ getScreenshotPath: () => "/ref/path" }) });
                const image = stubImage_();
                fs.existsSync.withArgs("/ref/path").returns(false);
                ScreenShooter.prototype.capture.resolves(image);

                await fn(browser);

                assert.calledOnce(image.save);
            });

            it("should not fail if there is no reference image", async () => {
                fs.existsSync.returns(false);
                const browser = await initBrowser_();

                await assert.isFulfilled(fn(browser));
            });

            it('should create "NoRefImageError" error with given parameters', async () => {
                sandbox.stub(NoRefImageError, "create").returns(Object.create(NoRefImageError.prototype));
                fs.existsSync.returns(false);
                temp.path.returns("/curr/path");

                const currImage = stubImage_({ size: { width: 100, height: 200 } });
                ScreenShooter.prototype.capture.resolves(currImage);

                const browser = await initBrowser_({ browser: stubBrowser_({ getScreenshotPath: () => "/ref/path" }) });

                await fn(browser, "state");

                assert.calledOnceWith(
                    NoRefImageError.create,
                    "state",
                    { path: "/curr/path", size: { width: 100, height: 200 } },
                    { path: "/ref/path", relativePath: "../path", size: null },
                );
            });

            it('should remember several "NoRefImageError" errors', async () => {
                fs.existsSync.returns(false);
                temp.path.returns("/curr/path");

                const browser = await initBrowser_();

                await fn(browser, "foo");
                await fn(browser, "bar");

                const [firstError, secondError] =
                    browser.publicAPI.executionContext.testplaneCtx.assertViewResults.get();
                assert.instanceOf(firstError, NoRefImageError);
                assert.instanceOf(secondError, NoRefImageError);
                assert.notEqual(firstError, secondError);
            });

            describe("update refs", () => {
                beforeEach(() => RuntimeConfig.getInstance.returns({ updateRefs: true, tempOpts: {} }));

                it("should be fulfilled if there is not reference image", async () => {
                    fs.existsSync.returns(false);
                    const browser = await initBrowser_();

                    await assert.isFulfilled(fn(browser));
                });

                it("should reject on reference update fail", async () => {
                    fs.existsSync.returns(false);
                    updateRefs.handleNoRefImage.throws();
                    const browser = await initBrowser_();

                    await assert.isRejected(fn(browser));
                });

                it('should pass browser emitter to "handleNoRefImage" handler', async () => {
                    fs.existsSync.returns(false);
                    const browser = await initBrowser_();

                    await fn(browser);

                    assert.calledWith(updateRefs.handleNoRefImage, sinon.match.any, sinon.match.any, sinon.match.any, {
                        emitter: browser.emitter,
                    });
                });
            });

            describe("image compare", () => {
                it("should add opts from runtime config to temp", async () => {
                    Image.compare.resolves({ equal: true, diffImage: { createBuffer: sandbox.stub() } });
                    RuntimeConfig.getInstance.returns({ tempOpts: { some: "opts" } });
                    const browser = await initBrowser_();

                    await fn(browser);

                    assert.calledOnceWith(temp.attach, { some: "opts", suffix: ".png" });
                });

                it("should compare a current image with a reference", async () => {
                    const config = mkConfig_({ getScreenshotPath: () => "/ref/path" });
                    const image = stubImage_();
                    Image.compare.resolves({ equal: true, diffImage: { createBuffer: sandbox.stub() } });
                    temp.path.returns("/curr/path");
                    fs.readFile.withArgs("/ref/path").resolves("refPngBuffer");
                    ScreenShooter.prototype.capture.resolves(image);
                    image.toPngBuffer.resolves("currPngBuffer");
                    const browser = await initBrowser_({ browser: stubBrowser_(config) });

                    await fn(browser);

                    assert.calledOnceWith(Image.compare, "refPngBuffer", "currPngBuffer");
                });

                it("should not save current image if images are equal", async () => {
                    const image = stubImage_();
                    const browser = await initBrowser_({
                        browser: stubBrowser_({ getScreenshotPath: () => "/ref/path" }),
                    });
                    fs.readFile.withArgs("/ref/path").resolves("refPngBuffer");
                    image.toPngBuffer.resolves("currPngBuffer");
                    Image.compare
                        .withArgs("refPngBuffer", "currPngBuffer")
                        .resolves({ equal: true, diffImage: { createBuffer: sandbox.stub() } });
                    ScreenShooter.prototype.capture.resolves(image);

                    await fn(browser);

                    assert.notCalled(fs.outputFile);
                });

                it("should save current image if images are not equal", async () => {
                    const image = stubImage_();
                    const browser = await initBrowser_({
                        browser: stubBrowser_({ getScreenshotPath: () => "/ref/path" }),
                    });
                    image.toPngBuffer.resolves("currPngBuffer");
                    Image.compare.withArgs("/ref/path", "currPngBuffer").resolves({ equal: false });
                    temp.path.returns("/curr/path");
                    ScreenShooter.prototype.capture.resolves(image);

                    await fn(browser);

                    assert.calledOnceWith(fs.outputFile, "/curr/path", "currPngBuffer");
                });

                it("should compare images with given set of parameters", async () => {
                    const config = mkConfig_({
                        tolerance: 100,
                        antialiasingTolerance: 200,
                        compareOpts: { stopOnFirstFail: true },
                    });
                    const browser = await initBrowser_({ browser: stubBrowser_(config) });

                    browser.prepareScreenshot.resolves({ canHaveCaret: "foo bar", pixelRatio: 300 });

                    await fn(browser);

                    assert.calledOnceWith(Image.compare, sinon.match.any, sinon.match.any, {
                        canHaveCaret: "foo bar",
                        tolerance: 100,
                        antialiasingTolerance: 200,
                        pixelRatio: 300,
                        compareOpts: { stopOnFirstFail: true },
                    });
                });

                ["tolerance", "antialiasingTolerance"].forEach(option => {
                    it(`should compare images with given "${option}"`, async () => {
                        const config = mkConfig_({ [option]: 100 });
                        const browser = await initBrowser_({ browser: stubBrowser_(config) });

                        browser.prepareScreenshot.resolves({});

                        await fn(browser, null, null, { [option]: 500 });

                        assert.calledOnceWith(
                            Image.compare,
                            sinon.match.any,
                            sinon.match.any,
                            sinon.match({ [option]: 500 }),
                        );
                    });
                });

                describe("if images are not equal", () => {
                    beforeEach(() => {
                        Image.compare.resolves({ equal: false, diffImage: { createBuffer: sandbox.stub() } });
                    });

                    describe("assert refs", () => {
                        it("should not reject", async () => {
                            const browser = await initBrowser_();

                            await assert.isFulfilled(fn(browser));
                        });

                        it('should create "ImageDiffError" error with given parameters', async () => {
                            sandbox.stub(ImageDiffError, "create").returns(Object.create(ImageDiffError.prototype));

                            temp.path.returns("/curr/path");

                            const browser = await initBrowser_({
                                browser: stubBrowser_({ getScreenshotPath: () => "/ref/path" }),
                            });
                            const currImage = stubImage_({ size: { width: 100, height: 200 } });

                            ScreenShooter.prototype.capture.resolves(currImage);
                            Image.compare.resolves({
                                equal: false,
                                metaInfo: { refImg: { size: { width: 300, height: 400 } } },
                                diffImage: { createBuffer: sandbox.stub() },
                            });

                            await fn(browser, "state");

                            assert.calledOnceWith(
                                ImageDiffError.create,
                                sinon.match({
                                    stateName: "state",
                                    currImg: { path: "/curr/path", size: { width: 100, height: 200 } },
                                    refImg: { path: "/ref/path", size: { width: 300, height: 400 } },
                                }),
                            );
                        });

                        it('should remember several "ImageDiffError" errors', async () => {
                            const browser = await initBrowser_();

                            await fn(browser, "foo");
                            await fn(browser, "bar");

                            const [firstError, secondError] =
                                browser.publicAPI.executionContext.testplaneCtx.assertViewResults.get();
                            assert.instanceOf(firstError, ImageDiffError);
                            assert.instanceOf(secondError, ImageDiffError);
                            assert.notEqual(firstError, secondError);
                        });

                        describe("passing diff options", () => {
                            it("should pass diff options for passed image paths", async () => {
                                const config = mkConfig_({ getScreenshotPath: () => "/reference/path" });
                                const browser = await initBrowser_({ browser: stubBrowser_(config) });
                                temp.path.returns("/current/path");

                                await fn(browser);
                                const e = browser.publicAPI.executionContext.testplaneCtx.assertViewResults.get()[0];

                                assert.match(e.diffOpts, { current: "/current/path", reference: "/reference/path" });
                            });

                            it("should pass diff options with passed compare options", async () => {
                                const config = {
                                    tolerance: 100,
                                    system: { diffColor: "#111111" },
                                };
                                const browser = await initBrowser_({ browser: stubBrowser_(config) });

                                await fn(browser);
                                const e = browser.publicAPI.executionContext.testplaneCtx.assertViewResults.get()[0];

                                assert.match(e.diffOpts, { tolerance: 100, diffColor: "#111111" });
                            });

                            it("should pass diff bounds to error", async () => {
                                Image.compare.resolves({
                                    diffBounds: { left: 0, top: 0, right: 10, bottom: 10 },
                                    diffImage: { createBuffer: sandbox.stub() },
                                });
                                const browser = await initBrowser_();

                                await fn(browser);

                                const e = browser.publicAPI.executionContext.testplaneCtx.assertViewResults.get()[0];

                                assert.deepEqual(e.diffBounds, { left: 0, top: 0, right: 10, bottom: 10 });
                            });

                            it("should pass diff clusters to error", async () => {
                                Image.compare.resolves({
                                    diffClusters: [{ left: 0, top: 0, right: 10, bottom: 10 }],
                                    diffImage: { createBuffer: sandbox.stub() },
                                });
                                const browser = await initBrowser_();

                                await fn(browser);
                                const e = browser.publicAPI.executionContext.testplaneCtx.assertViewResults.get()[0];

                                assert.deepEqual(e.diffClusters, [{ left: 0, top: 0, right: 10, bottom: 10 }]);
                            });
                        });
                    });

                    describe("update refs", () => {
                        beforeEach(() => RuntimeConfig.getInstance.returns({ updateRefs: true, tempOpts: {} }));

                        it("should be fulfilled", async () => {
                            const browser = await initBrowser_();

                            await assert.isFulfilled(fn(browser));
                        });

                        ["tolerance", "antialiasingTolerance"].forEach(option => {
                            describe(`should update with "${option}" option`, () => {
                                it(`from config option "${option}"`, async () => {
                                    const config = mkConfig_({ [option]: 1 });
                                    const browser = await initBrowser_({ browser: stubBrowser_(config) });

                                    await fn(browser);

                                    assert.calledOnceWith(
                                        updateRefs.handleImageDiff,
                                        sinon.match.any,
                                        sinon.match.any,
                                        sinon.match.any,
                                        sinon.match({ [option]: 1 }),
                                    );
                                });

                                it(`from config option "assertViewOpts" even if it is set in "${option}"`, async () => {
                                    const config = mkConfig_({
                                        [option]: 1,
                                        assertViewOpts: {
                                            [option]: 2,
                                        },
                                    });
                                    const browser = await initBrowser_({ browser: stubBrowser_(config) });

                                    await fn(browser);

                                    assert.calledOnceWith(
                                        updateRefs.handleImageDiff,
                                        sinon.match.any,
                                        sinon.match.any,
                                        sinon.match.any,
                                        sinon.match({ [option]: 2 }),
                                    );
                                });

                                it(`from "assertView" command even if it is set in "assertViewOpts" and "${option}"`, async () => {
                                    const config = mkConfig_({
                                        [option]: 1,
                                        assertViewOpts: {
                                            [option]: 2,
                                        },
                                    });
                                    const browser = await initBrowser_({ browser: stubBrowser_(config) });

                                    await fn(browser, null, null, { [option]: 3 });

                                    assert.calledOnceWith(
                                        updateRefs.handleImageDiff,
                                        sinon.match.any,
                                        sinon.match.any,
                                        sinon.match.any,
                                        sinon.match({ [option]: 3 }),
                                    );
                                });
                            });
                        });

                        it('should pass browser emitter to "handleImageDiff" handler', async () => {
                            const browser = await initBrowser_();
                            browser.prepareScreenshot.resolves({ canHaveCaret: true });

                            await fn(browser);

                            assert.calledOnceWith(
                                updateRefs.handleImageDiff,
                                sinon.match.any,
                                sinon.match.any,
                                sinon.match.any,
                                sinon.match({ emitter: browser.emitter }),
                            );
                        });
                    });
                });

                describe("if ignoreDiffPixelCount is specified", () => {
                    beforeEach(() => {
                        sandbox.stub(ImageDiffError, "create").returns(Object.create(ImageDiffError.prototype));
                        Image.compare.resolves({
                            equal: false,
                            diffImage: { createBuffer: sandbox.stub() },
                            differentPixels: 10,
                            totalPixels: 50,
                        });
                    });

                    describe("as number", () => {
                        it("and images are still considered not same", async () => {
                            const browser = await initBrowser_();

                            await fn(browser, "state", "selector", { ignoreDiffPixelCount: 5 });

                            assert.calledOnceWith(
                                ImageDiffError.create,
                                sinon.match({
                                    differentPixels: 10,
                                    diffRatio: 0.2,
                                }),
                            );
                        });

                        it("and images are considered the same", async () => {
                            const browser = await initBrowser_();

                            await fn(browser, "state", "selector", { ignoreDiffPixelCount: 20 });

                            assert.notCalled(ImageDiffError.create);
                        });
                    });

                    describe("as percent string", () => {
                        it("and images are still considered not same", async () => {
                            const browser = await initBrowser_();

                            await fn(browser, "state", "selector", { ignoreDiffPixelCount: "10%" });

                            assert.calledOnceWith(
                                ImageDiffError.create,
                                sinon.match({
                                    differentPixels: 10,
                                    diffRatio: 0.2,
                                }),
                            );
                        });

                        it("and images are considered the same", async () => {
                            const browser = await initBrowser_();

                            await fn(browser, "state", "selector", { ignoreDiffPixelCount: "40%" });

                            assert.notCalled(ImageDiffError.create);
                        });

                        describe("and value is not valid", () => {
                            [
                                { caseName: "negative value", value: "-4%" },
                                { caseName: "more than 100", value: "146%" },
                                { caseName: "not a percent number", value: "5" },
                                { caseName: "not a number", value: "foo" },
                            ].forEach(({ caseName, value }) => {
                                it(caseName, async () => {
                                    const browser = await initBrowser_();

                                    await assert.isRejected(
                                        fn(browser, "state", "selector", { ignoreDiffPixelCount: value }),
                                    );
                                });
                            });
                        });
                    });
                });
            });

            it("should remember several success assert view calls", async () => {
                Image.compare
                    .onFirstCall()
                    .resolves({ equal: true, metaInfo: { refImg: { size: { height: 200, width: 100 } } } })
                    .onSecondCall()
                    .resolves({ equal: true, metaInfo: { refImg: { size: { height: 400, width: 300 } } } });
                const getScreenshotPath = sandbox.stub();

                getScreenshotPath
                    .withArgs(sinon.match.any, "plain")
                    .returns("/ref/path/plain")
                    .withArgs(sinon.match.any, "complex")
                    .returns("/ref/path/complex");

                const bufferPlain = Buffer.from("plain-data", "base64");
                const bufferComplex = Buffer.from("complex-data", "base64");

                fs.readFileSync
                    .withArgs("/ref/path/plain")
                    .returns(bufferPlain)
                    .withArgs("/ref/path/complex")
                    .returns(bufferComplex);

                const imagePlain = stubImage_({ size: { width: 100, height: 200 } });
                const imageComplex = stubImage_({ size: { width: 300, height: 400 } });

                Image.create.withArgs(bufferPlain).returns(imagePlain).withArgs(bufferComplex).returns(imageComplex);

                const browser = await initBrowser_({ browser: stubBrowser_({ getScreenshotPath }) });

                await fn(browser, "plain");
                await fn(browser, "complex");

                assert.deepEqual(browser.publicAPI.executionContext.testplaneCtx.assertViewResults.get(), [
                    {
                        stateName: "plain",
                        refImg: {
                            path: "/ref/path/plain",
                            relativePath: "../path/plain",
                            size: { width: 100, height: 200 },
                        },
                    },
                    {
                        stateName: "complex",
                        refImg: {
                            path: "/ref/path/complex",
                            relativePath: "../path/complex",
                            size: { width: 300, height: 400 },
                        },
                    },
                ]);
            });
        });
    });
});
