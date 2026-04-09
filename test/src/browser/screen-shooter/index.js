"use strict";

const { Image } = require("src/image");

const validationStubs = {
    assertCorrectCaptureAreaBounds: sinon.stub(),
};

const utilsStubs = {
    findScrollParentAndScrollBy: sinon.stub().resolves({
        viewportOffset: { left: 0, top: 0 },
        scrollElementOffset: { left: 0, top: 0 },
        readableSelectorToScrollDescr: "window",
        debugLog: "debug info",
    }),
    getBoundingRects: sinon.stub().resolves([]),
};

const proxyquire = require("proxyquire");
const { ScreenShooter } = proxyquire("src/browser/screen-shooter", {
    "./validation": validationStubs,
    "./utils": utilsStubs,
});
const { CompositeImage } = require("src/browser/screen-shooter/composite-image");

describe("ScreenShooter", () => {
    const sandbox = sinon.createSandbox();
    let browser;
    let imageStub;
    let compositeImageStub;
    let renderedImageStub;

    const createMockPage = (overrides = {}) => ({
        captureArea: { left: 0, top: 0, width: 100, height: 200 },
        safeArea: { left: 0, top: 0, width: 100, height: 100 },
        ignoreAreas: [],
        viewport: { left: 0, top: 0, width: 100, height: 100 },
        viewportOffset: { left: 0, top: 0 },
        scrollElementOffset: { left: 0, top: 0 },
        documentHeight: 1000,
        documentWidth: 100,
        canHaveCaret: false,
        pixelRatio: 1,
        debugLog: "debug info",
        ...overrides,
    });

    const createDefaultOpts = (overrides = {}) => ({
        ignoreElements: [],
        allowViewportOverflow: false,
        captureElementFromTop: true,
        compositeImage: true,
        screenshotDelay: 0,
        debugId: "test-screenshot",
        ...overrides,
    });

    beforeEach(() => {
        imageStub = sandbox.createStubInstance(Image);
        renderedImageStub = sandbox.createStubInstance(Image);

        compositeImageStub = {
            registerViewportImageAtOffset: sandbox.stub().resolves(),
            render: sandbox.stub().resolves(renderedImageStub),
            hasNotCapturedArea: sandbox.stub().returns(false),
            getNextNotCapturedArea: sandbox.stub().returns(null),
        };

        sandbox.stub(CompositeImage, "create").returns(compositeImageStub);

        validationStubs.assertCorrectCaptureAreaBounds.reset();
        utilsStubs.findScrollParentAndScrollBy.reset();
        utilsStubs.getBoundingRects.reset();

        utilsStubs.findScrollParentAndScrollBy.resolves({
            viewportOffset: { left: 0, top: 0 },
            scrollElementOffset: { left: 0, top: 0 },
            readableSelectorToScrollDescr: "window",
            debugLog: "debug info",
        });
        utilsStubs.getBoundingRects.resolves([]);

        browser = {
            config: {},
            publicAPI: {
                execute: sandbox.stub(),
                action: sandbox.stub().returns({
                    move: sandbox.stub().returnsThis(),
                    perform: sandbox.stub().resolves(),
                }),
                findElements: sandbox.stub().resolves([]),
                switchToFrame: sandbox.stub().resolves(),
                $: sandbox.stub(),
            },
            callMethodOnBrowserSide: sandbox.stub().resolves(createMockPage()),
            captureViewportImage: sandbox.stub().resolves(imageStub),
            get shouldUsePixelRatio() {
                return true;
            },
            get isWebdriverProtocol() {
                return true;
            },
        };
    });

    afterEach(() => sandbox.restore());

    describe("create", () => {
        it("should create new ScreenShooter instance", () => {
            const screenShooter = ScreenShooter.create(browser);

            assert.instanceOf(screenShooter, ScreenShooter);
        });
    });

    describe("capture", () => {
        let screenShooter;

        beforeEach(() => {
            screenShooter = ScreenShooter.create(browser);
        });

        describe("basic functionality", () => {
            it("should accept single selector as string", async () => {
                const selector = ".element";

                await screenShooter.capture(selector);

                const [method, args] = browser.callMethodOnBrowserSide.firstCall.args;
                assert.equal(method, "prepareScreenshot");
                assert.deepEqual(args[0], [selector]);
            });

            it("should accept multiple selectors as array", async () => {
                const selectors = [".element1", ".element2"];

                await screenShooter.capture(selectors);

                const [method, args] = browser.callMethodOnBrowserSide.firstCall.args;
                assert.equal(method, "prepareScreenshot");
                assert.deepEqual(args[0], selectors);
            });

            it("should pass options to prepareScreenshot", async () => {
                const opts = createDefaultOpts({
                    ignoreElements: [".ignore1", ".ignore2"],
                    allowViewportOverflow: true,
                    captureElementFromTop: false,
                    selectorToScroll: ".scrollable",
                    disableAnimation: true,
                });

                await screenShooter.capture(".element", opts);

                const [method, args] = browser.callMethodOnBrowserSide.firstCall.args;
                assert.equal(method, "prepareScreenshot");
                assert.deepEqual(args[0], [".element"]);
                assert.deepEqual(args[1], {
                    ignoreSelectors: [".ignore1", ".ignore2"],
                    allowViewportOverflow: true,
                    captureElementFromTop: false,
                    selectorToScroll: ".scrollable",
                    disableAnimation: true,
                    disableHover: undefined,
                    compositeImage: true,
                    usePixelRatio: true,
                    debug: false,
                });
            });

            it("should handle single ignoreElement as string", async () => {
                const opts = { ignoreElements: ".single-ignore" };

                await screenShooter.capture(".element", opts);

                const [method, args] = browser.callMethodOnBrowserSide.firstCall.args;
                assert.equal(method, "prepareScreenshot");
                assert.deepEqual(args[0], [".element"]);
                assert.deepEqual(args[1].ignoreSelectors, [".single-ignore"]);
            });

            it("should remove debugLog from page result", async () => {
                const pageWithDebugLog = createMockPage({ debugLog: "some debug info" });
                browser.callMethodOnBrowserSide.resolves(pageWithDebugLog);

                await screenShooter.capture(".element");

                assert.isUndefined(pageWithDebugLog.debugLog);
            });
        });

        describe("validation", () => {
            it("should call assertCorrectCaptureAreaBounds with correct parameters", async () => {
                const selectors = [".element1", ".element2"];
                const page = createMockPage();
                const opts = createDefaultOpts();
                browser.callMethodOnBrowserSide.resolves(page);

                await screenShooter.capture(selectors, opts);

                assert.calledOnceWith(
                    validationStubs.assertCorrectCaptureAreaBounds,
                    JSON.stringify(selectors),
                    page.viewport,
                    page.viewportOffset,
                    page.captureArea,
                    opts,
                );
            });
        });

        describe("image capture and composition", () => {
            it("should capture viewport image with page and screenshotDelay", async () => {
                const page = createMockPage();
                const opts = createDefaultOpts({ screenshotDelay: 500 });
                browser.callMethodOnBrowserSide.resolves(page);

                await screenShooter.capture(".element", opts);

                assert.calledOnceWith(browser.captureViewportImage, page.viewport, 500);
            });

            it("should create CompositeImage with page data", async () => {
                const page = createMockPage({
                    captureArea: { left: 10, top: 20, width: 300, height: 400 },
                    safeArea: { left: 0, top: 0, width: 100, height: 150 },
                    ignoreAreas: [{ left: 50, top: 50, width: 20, height: 20 }],
                });
                browser.callMethodOnBrowserSide.resolves(page);

                await screenShooter.capture(".element");

                assert.calledOnceWith(CompositeImage.create, page.captureArea, page.safeArea, page.ignoreAreas);
            });

            it("should register viewport image at offset", async () => {
                const page = createMockPage({
                    scrollElementOffset: { left: 10, top: 20 },
                    viewportOffset: { left: 5, top: 15 },
                });
                browser.callMethodOnBrowserSide.resolves(page);

                await screenShooter.capture(".element");

                assert.calledOnceWith(
                    compositeImageStub.registerViewportImageAtOffset,
                    imageStub,
                    page.scrollElementOffset,
                    page.viewportOffset,
                );
            });

            it("should render composite image and return result", async () => {
                const page = createMockPage();
                browser.callMethodOnBrowserSide.resolves(page);

                const result = await screenShooter.capture(".element");

                assert.calledOnce(compositeImageStub.render);
                assert.deepEqual(result, {
                    image: renderedImageStub,
                    meta: page,
                });
            });
        });

        describe("scrolling and composite image extension", () => {
            beforeEach(() => {
                compositeImageStub.hasNotCapturedArea.returns(true);
                compositeImageStub.getNextNotCapturedArea.returns({
                    left: 0,
                    top: 100,
                    width: 100,
                    height: 100,
                });

                utilsStubs.getBoundingRects
                    .onCall(0)
                    .resolves([{ top: 100, left: 0, width: 100, height: 100 }])
                    .onCall(1)
                    .resolves([{ top: 50, left: 0, width: 100, height: 100 }]);

                utilsStubs.findScrollParentAndScrollBy.resolves({
                    viewportOffset: { left: 0, top: 0 },
                    scrollElementOffset: { left: 0, top: 50 },
                    readableSelectorToScrollDescr: "window",
                    debugLog: "scroll debug info",
                });
            });

            it("should not scroll when compositeImage is disabled", async () => {
                const opts = createDefaultOpts({ compositeImage: false });

                await screenShooter.capture(".element", opts);

                assert.notCalled(utilsStubs.findScrollParentAndScrollBy);
                assert.notCalled(utilsStubs.getBoundingRects);
            });

            it("should not scroll when hasNotCapturedArea returns false", async () => {
                compositeImageStub.hasNotCapturedArea.returns(false);

                await screenShooter.capture(".element");

                assert.notCalled(utilsStubs.findScrollParentAndScrollBy);
            });

            it("should scroll once when there is uncaptured area", async () => {
                compositeImageStub.hasNotCapturedArea.onCall(0).returns(true).onCall(1).returns(false);

                const opts = createDefaultOpts();
                await screenShooter.capture(".element", opts);

                assert.calledOnce(utilsStubs.findScrollParentAndScrollBy);
                assert.calledTwice(utilsStubs.getBoundingRects);
            });

            it("should capture new image after scrolling", async () => {
                const page = createMockPage();
                browser.callMethodOnBrowserSide.resolves(page);

                compositeImageStub.hasNotCapturedArea.onCall(0).returns(true).onCall(1).returns(false);

                const opts = createDefaultOpts();
                await screenShooter.capture(".element", opts);

                assert.calledTwice(browser.captureViewportImage);
                assert.calledTwice(compositeImageStub.registerViewportImageAtOffset);
            });

            it("should calculate correct scroll height based on pixelRatio", async () => {
                const page = createMockPage({ pixelRatio: 2 });
                browser.callMethodOnBrowserSide.resolves(page);

                compositeImageStub.hasNotCapturedArea.onCall(0).returns(true).onCall(1).returns(false);
                compositeImageStub.getNextNotCapturedArea.returns({
                    left: 0,
                    top: 100,
                    width: 100,
                    height: 200,
                });

                const opts = createDefaultOpts();
                await screenShooter.capture(".element", opts);

                const scrollCall = utilsStubs.findScrollParentAndScrollBy.getCall(0);
                const scrollParams = scrollCall.args[1];

                // Physical scroll height should be min(200, 100) = 100
                // Logical scroll height should be ceil(100 / 2) - 1 = 49
                assert.equal(scrollParams.y, 49);
            });

            it("should pass correct selectors to scroll functions", async () => {
                const selectors = [".element1", ".element2"];
                const opts = createDefaultOpts({ selectorToScroll: ".scrollable" });

                compositeImageStub.hasNotCapturedArea.onCall(0).returns(true).onCall(1).returns(false);

                await screenShooter.capture(selectors, opts);

                assert.calledWith(utilsStubs.getBoundingRects, browser.publicAPI, selectors);
                assert.calledWith(
                    utilsStubs.findScrollParentAndScrollBy,
                    browser.publicAPI,
                    sinon.match({
                        selectorToScroll: ".scrollable",
                        selectorsToCapture: selectors,
                    }),
                );
            });

            it("should stop scrolling when reaching scroll limit (same bounding rects)", async () => {
                compositeImageStub.hasNotCapturedArea.returns(true);

                utilsStubs.getBoundingRects
                    .onCall(0)
                    .resolves([{ top: 100, left: 0, width: 100, height: 100 }])
                    .onCall(1)
                    .resolves([{ top: 100, left: 0, width: 100, height: 100 }]);

                const opts = createDefaultOpts();
                await screenShooter.capture(".element", opts);

                assert.calledOnce(utilsStubs.findScrollParentAndScrollBy);
                assert.calledTwice(utilsStubs.getBoundingRects);
            });

            it("should limit scrolling iterations to 50", async () => {
                compositeImageStub.hasNotCapturedArea.returns(true);
                compositeImageStub.getNextNotCapturedArea.returns({
                    left: 0,
                    top: 100,
                    width: 100,
                    height: 100,
                });

                let callCount = 0;
                utilsStubs.getBoundingRects.callsFake(() => {
                    return Promise.resolve([{ top: callCount++, left: 0, width: 100, height: 100 }]);
                });

                let scrollCallCount = 0;
                utilsStubs.findScrollParentAndScrollBy.callsFake(() => {
                    return Promise.resolve({
                        viewportOffset: { left: 0, top: scrollCallCount },
                        scrollElementOffset: { left: 0, top: scrollCallCount++ },
                        readableSelectorToScrollDescr: "window",
                        debugLog: "scroll debug info",
                    });
                });

                const opts = createDefaultOpts();
                await screenShooter.capture(".element", opts);

                assert.equal(utilsStubs.findScrollParentAndScrollBy.callCount, 50);
            });

            it("should show warning when reaching scroll limit without allowViewportOverflow", async () => {
                const consoleWarnStub = sandbox.stub(console, "warn");
                const opts = createDefaultOpts({
                    allowViewportOverflow: false,
                    debugId: "test-screenshot",
                    selectorToScroll: ".custom-scroll",
                });

                compositeImageStub.hasNotCapturedArea.returns(true);
                utilsStubs.getBoundingRects.resolves([{ top: 100, left: 0, width: 100, height: 100 }]);
                utilsStubs.findScrollParentAndScrollBy.resolves({
                    viewportOffset: { left: 0, top: 0 },
                    scrollElementOffset: { left: 0, top: 0 },
                    readableSelectorToScrollDescr: ".custom-scroll",
                    debugLog: "debug",
                });

                await screenShooter.capture([".element1", ".element2"], opts);

                assert.calledOnce(consoleWarnStub);
                const warningMessage = consoleWarnStub.getCall(0).args[0];
                assert.include(warningMessage, "test-screenshot");
                assert.include(warningMessage, ".element1; .element2");
                assert.include(warningMessage, ".custom-scroll");
                assert.include(warningMessage, "allowViewportOverflow");
            });

            it("should not show warning when reaching scroll limit with allowViewportOverflow", async () => {
                const consoleWarnStub = sandbox.stub(console, "warn");
                const opts = createDefaultOpts({ allowViewportOverflow: true });

                compositeImageStub.hasNotCapturedArea.returns(true);
                utilsStubs.getBoundingRects.resolves([{ top: 100, left: 0, width: 100, height: 100 }]);

                await screenShooter.capture(".element", opts);

                assert.notCalled(consoleWarnStub);
            });

            it("should show auto-detected scroll element in warning when selectorToScroll not provided", async () => {
                const consoleWarnStub = sandbox.stub(console, "warn");
                const opts = createDefaultOpts({ allowViewportOverflow: false });

                compositeImageStub.hasNotCapturedArea.returns(true);
                utilsStubs.getBoundingRects.resolves([{ top: 100, left: 0, width: 100, height: 100 }]);
                utilsStubs.findScrollParentAndScrollBy.resolves({
                    viewportOffset: { left: 0, top: 0 },
                    scrollElementOffset: { left: 0, top: 0 },
                    readableSelectorToScrollDescr: "auto-detected .scrollable-parent",
                    debugLog: "debug",
                });

                await screenShooter.capture(".element", opts);

                const warningMessage = consoleWarnStub.getCall(0).args[0];
                assert.include(warningMessage, "auto-detected .scrollable-parent");
                assert.notInclude(warningMessage, "you requested to scroll the following selector:");
            });
        });

        describe("error handling", () => {
            it("should handle getBoundingRects errors gracefully", async () => {
                compositeImageStub.hasNotCapturedArea.onCall(0).returns(true).onCall(1).returns(false);
                compositeImageStub.getNextNotCapturedArea.returns({
                    left: 0,
                    top: 100,
                    width: 100,
                    height: 100,
                });

                utilsStubs.getBoundingRects
                    .onCall(0)
                    .rejects(new Error("Element not found"))
                    .onCall(1)
                    .rejects(new Error("Element not found"));

                const opts = createDefaultOpts();
                await assert.isFulfilled(screenShooter.capture(".element", opts));

                assert.calledOnce(utilsStubs.findScrollParentAndScrollBy);
            });

            it("should propagate prepareScreenshot errors", async () => {
                const error = new Error("Prepare screenshot failed");
                browser.callMethodOnBrowserSide.rejects(error);

                const promise = screenShooter.capture(".element");

                const thrownError = await promise.catch(e => e);
                assert.include(thrownError.message, "Prepare screenshot failed");
            });

            it("should propagate captureViewportImage errors", async () => {
                const error = new Error("Capture failed");
                browser.captureViewportImage.rejects(error);

                const promise = screenShooter.capture(".element");

                const thrownError = await promise.catch(e => e);
                assert.include(thrownError.message, "Capture failed");
            });

            it("should propagate CompositeImage errors", async () => {
                const error = new Error("Composite failed");
                compositeImageStub.render.rejects(error);

                const promise = screenShooter.capture(".element");

                const thrownError = await promise.catch(e => e);
                assert.include(thrownError.message, "Composite failed");
            });
        });
    });
});
