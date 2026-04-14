"use strict";

const proxyquire = require("proxyquire").noCallThru();
const { CaptureAreaMovedError } = require("src/browser/screen-shooter/errors/capture-area-moved-error");

const validationStubs = {
    assertCorrectCaptureAreaBounds: sinon.stub(),
};

const historyStubs = {
    runWithoutHistory: sinon.stub(),
};

const operationsStubs = {
    disableIframeAnimations: sinon.stub(),
    cleanupPageAnimations: sinon.stub(),
    cleanupPointerEvents: sinon.stub(),
    cleanupScrolls: sinon.stub(),
    preparePointerForScreenshot: sinon.stub(),
};

const clientBridgeCreateStub = sinon.stub();
const compositeImageCreateStub = sinon.stub();

const { ElementsScreenShooter } = proxyquire("src/browser/screen-shooter/elements-screen-shooter", {
    "./validation": validationStubs,
    "../history": historyStubs,
    "./operations": operationsStubs,
    "../client-bridge": {
        ClientBridge: {
            create: clientBridgeCreateStub,
        },
    },
    "./composite-image": {
        CompositeImage: {
            create: compositeImageCreateStub,
        },
    },
});

describe("ElementsScreenShooter", () => {
    const sandbox = sinon.createSandbox();

    let browser;
    let browserProperties;
    let browserSideScreenshooter;
    let camera;
    let viewportImage;
    let renderedImage;
    let compositeImage;
    let screenShooter;

    const rect = (left = 0, top = 0, width = 100, height = 80) => ({ left, top, width, height });
    const size = (width = 100, height = 100) => ({ width, height });
    const band = (top = 0, height = 100) => ({ top, height });
    const captureSpec = (full, visible = full) => ({ full, visible });

    const createMockPage = (overrides = {}) =>
        Object.assign(
            {
                safeArea: band(0, 100),
                ignoreAreas: [],
                captureSpecs: [captureSpec(rect(0, 0, 100, 80))],
                viewportSize: size(100, 100),
                viewportOffset: { left: 0, top: 0 },
                documentSize: size(100, 1000),
                canHaveCaret: false,
                pixelRatio: 1,
                pointerEventsDisabled: false,
                readableSelectorToScrollDescr: "html",
                scrollOffset: 0,
                debugLog: "prepare debug",
            },
            overrides,
        );

    const createCaptureState = (overrides = {}) =>
        Object.assign(
            {
                scrollOffset: 0,
                captureSpecs: [captureSpec(rect(0, 0, 100, 80))],
                ignoreAreas: [],
                safeArea: band(0, 100),
                debugLog: "state debug",
            },
            overrides,
        );

    const resetSharedStub = (stub, setup) => {
        stub.resetHistory();
        stub.resetBehavior();
        if (setup) {
            setup(stub);
        }
    };

    const stubSuccessfulCapture = ({ page = createMockPage(), opts = {} } = {}) => {
        browserSideScreenshooter.call.resolves(page);

        const captureResult = {
            render: sandbox.stub().resolves(renderedImage),
        };

        sandbox.stub(screenShooter, "_performCaptureAttempt").resolves(captureResult);
        sandbox.stub(screenShooter, "_cleanupScreenshot").resolves();

        return screenShooter.capture(".element", opts);
    };

    beforeEach(() => {
        resetSharedStub(validationStubs.assertCorrectCaptureAreaBounds);
        resetSharedStub(historyStubs.runWithoutHistory, stub => stub.callsFake((_ctx, fn) => fn()));
        Object.values(operationsStubs).forEach(stub => resetSharedStub(stub, s => s.resolves()));
        resetSharedStub(clientBridgeCreateStub);
        resetSharedStub(compositeImageCreateStub);

        sandbox.stub(global, "setTimeout").callsFake((fn, _delay, ...args) => {
            if (typeof fn === "function") {
                fn(...args);
            }

            return 0;
        });

        browser = {
            execute: sandbox.stub().resolves(undefined),
        };
        browserProperties = {
            isWebdriverProtocol: true,
            shouldUsePixelRatio: true,
            needsCompatLib: false,
        };
        browserSideScreenshooter = {
            call: sandbox.stub(),
        };
        viewportImage = { id: "viewport-image" };
        renderedImage = { id: "rendered-image" };
        camera = {
            captureViewportImage: sandbox.stub().resolves(viewportImage),
        };
        compositeImage = {
            registerViewportImageAtOffset: sandbox.stub().resolves(),
            render: sandbox.stub().resolves(renderedImage),
        };

        clientBridgeCreateStub.resolves(browserSideScreenshooter);
        compositeImageCreateStub.returns(compositeImage);

        screenShooter = new ElementsScreenShooter({
            browser,
            camera,
            browserProperties,
            browserSideScreenshooter,
        });
    });

    afterEach(() => sandbox.restore());

    describe("create", () => {
        it("should create new ElementsScreenShooter instance", async () => {
            const result = await ElementsScreenShooter.create({
                browser,
                camera,
                browserProperties,
            });

            assert.instanceOf(result, ElementsScreenShooter);
            assert.calledOnceWithExactly(clientBridgeCreateStub, browser, "screen-shooter", {
                needsCompatLib: false,
            });
        });
    });

    describe("capture", () => {
        it("should accept single selector as string", async () => {
            await stubSuccessfulCapture();

            const [method, args] = browserSideScreenshooter.call.firstCall.args;
            assert.equal(method, "prepareElementsScreenshot");
            assert.deepEqual(args[0], [".element"]);
        });

        it("should accept multiple selectors as array", async () => {
            const page = createMockPage();
            browserSideScreenshooter.call.resolves(page);
            sandbox.stub(screenShooter, "_performCaptureAttempt").resolves({
                render: sandbox.stub().resolves(renderedImage),
            });
            sandbox.stub(screenShooter, "_cleanupScreenshot").resolves();

            await screenShooter.capture([".element1", ".element2"]);

            const [method, args] = browserSideScreenshooter.call.firstCall.args;
            assert.equal(method, "prepareElementsScreenshot");
            assert.deepEqual(args[0], [".element1", ".element2"]);
        });

        it("should pass options to prepareElementsScreenshot", async () => {
            const opts = {
                ignoreElements: [".ignore1", ".ignore2"],
                allowViewportOverflow: true,
                captureElementFromTop: false,
                selectorToScroll: ".scrollable",
                disableAnimation: true,
                disableHover: "always",
                compositeImage: true,
            };

            await stubSuccessfulCapture({ opts });

            const [method, args] = browserSideScreenshooter.call.firstCall.args;
            assert.equal(method, "prepareElementsScreenshot");
            assert.deepEqual(args[0], [".element"]);
            assert.deepEqual(args[1], {
                ignoreSelectors: [".ignore1", ".ignore2"],
                allowViewportOverflow: true,
                captureElementFromTop: false,
                selectorToScroll: ".scrollable",
                disableAnimation: true,
                disableHover: "always",
                compositeImage: true,
                debug: [],
                usePixelRatio: true,
            });
        });

        it("should handle single ignoreElement as string", async () => {
            await stubSuccessfulCapture({ opts: { ignoreElements: ".single-ignore" } });

            const [, args] = browserSideScreenshooter.call.firstCall.args;
            assert.deepEqual(args[1].ignoreSelectors, [".single-ignore"]);
        });

        it("should throw if no selectors were passed", async () => {
            await assert.isRejected(
                screenShooter.capture([]),
                /No selectors to capture passed to ElementsScreenShooter\.capture/,
            );
        });

        it("should call assertCorrectCaptureAreaBounds with correct parameters", async () => {
            const selectors = [".element1", ".element2"];
            const page = createMockPage({
                captureSpecs: [captureSpec(rect(1, 2, 30, 40)), captureSpec(rect(3, 4, 50, 60))],
            });
            const opts = { allowViewportOverflow: true };

            browserSideScreenshooter.call.resolves(page);
            sandbox.stub(screenShooter, "_performCaptureAttempt").resolves({
                render: sandbox.stub().resolves(renderedImage),
            });
            sandbox.stub(screenShooter, "_cleanupScreenshot").resolves();

            await screenShooter.capture(selectors, opts);

            assert.calledOnceWithExactly(
                validationStubs.assertCorrectCaptureAreaBounds,
                JSON.stringify(selectors),
                page.viewportSize,
                page.viewportOffset,
                page.captureSpecs.map(spec => spec.full),
                opts,
            );
        });

        it("should prepare pointer state before capture attempt", async () => {
            const page = createMockPage({ pointerEventsDisabled: true });

            await stubSuccessfulCapture({
                page,
                opts: { disableHover: "when-scrolling-needed" },
            });

            assert.calledOnceWithExactly(operationsStubs.preparePointerForScreenshot, browser, {
                disableHover: "when-scrolling-needed",
                pointerEventsDisabled: true,
            });
        });

        it("should disable iframe animations during prepare when requested", async () => {
            await stubSuccessfulCapture({ opts: { disableAnimation: true } });

            assert.calledOnceWithExactly(operationsStubs.disableIframeAnimations, browser, browserSideScreenshooter);
        });

        it("should retry retriable errors and validate capture area stability on retry", async () => {
            const page = createMockPage();
            const changedState = createCaptureState({
                captureSpecs: [captureSpec(rect(0, 0, 100, 120))],
                safeArea: band(0, 100),
            });
            const stableState = createCaptureState({
                captureSpecs: page.captureSpecs,
                ignoreAreas: page.ignoreAreas,
                safeArea: page.safeArea,
            });

            browserSideScreenshooter.call
                .onCall(0)
                .resolves(page)
                .onCall(1)
                .resolves(changedState)
                .onCall(2)
                .resolves(page)
                .onCall(3)
                .resolves(stableState)
                .onCall(4)
                .resolves(stableState)
                .onCall(5)
                .resolves(stableState);

            const result = await screenShooter.capture(".element", {}, 2);

            assert.deepEqual(
                browserSideScreenshooter.call
                    .getCalls()
                    .map(call => call.args[0])
                    .filter(method => method === "prepareElementsScreenshot"),
                ["prepareElementsScreenshot", "prepareElementsScreenshot"],
            );
            assert.calledOnce(camera.captureViewportImage);
            assert.deepEqual(result, {
                image: renderedImage,
                meta: page,
            });
        });

        it("should return rendered image and page meta", async () => {
            const page = createMockPage();
            browserSideScreenshooter.call.resolves(page);
            sandbox.stub(screenShooter, "_cleanupScreenshot").resolves();
            sandbox.stub(screenShooter, "_performCaptureAttempt").resolves(compositeImage);

            const result = await screenShooter.capture(".element");

            assert.calledOnce(compositeImage.render);
            assert.deepEqual(result, {
                image: renderedImage,
                meta: page,
            });
        });

        it("should cleanup even when rendering fails", async () => {
            const renderError = new Error("Composite failed");
            const cleanupStub = sandbox.stub(screenShooter, "_cleanupScreenshot").resolves();

            browserSideScreenshooter.call.resolves(createMockPage());
            sandbox.stub(screenShooter, "_performCaptureAttempt").resolves({
                render: sandbox.stub().rejects(renderError),
            });

            await assert.isRejected(screenShooter.capture(".element"), /Composite failed/);
            assert.calledOnce(cleanupStub);
        });

        it("should propagate browser-side preparation errors with descriptive message", async () => {
            browserSideScreenshooter.call.resolves({
                errorCode: "JS",
                message: "boom",
                debugLog: "prepare debug",
            });

            const error = await screenShooter.capture(".element", { allowViewportOverflow: true }).catch(e => e);

            assert.instanceOf(error, Error);
            assert.include(error.message, 'selectors: [".element"]');
            assert.include(error.message, '"allowViewportOverflow":true');
            assert.include(error.message, "error: boom");
        });

        it("should capture viewport image with viewport parameters and screenshot delay", async () => {
            const page = createMockPage();
            const state = createCaptureState({
                captureSpecs: page.captureSpecs,
                ignoreAreas: page.ignoreAreas,
                safeArea: page.safeArea,
            });

            browserSideScreenshooter.call.onCall(0).resolves(page).onCall(1).resolves(state);

            const result = await screenShooter.capture(".element", {
                screenshotDelay: 500,
                compositeImage: true,
            });

            assert.calledOnceWithExactly(camera.captureViewportImage, {
                viewportSize: page.viewportSize,
                viewportOffset: page.viewportOffset,
                screenshotDelay: 500,
            });
            assert.calledOnceWithExactly(
                compositeImage.registerViewportImageAtOffset,
                viewportImage,
                state.safeArea,
                state.captureSpecs,
                state.ignoreAreas,
            );
            assert.deepEqual(result, {
                image: renderedImage,
                meta: page,
            });
        });

        it("should stop after the first chunk when compositeImage is false", async () => {
            sandbox.stub(console, "warn");
            const page = createMockPage({
                viewportSize: size(100, 100),
                captureSpecs: [captureSpec(rect(0, 0, 100, 150))],
            });
            const state = createCaptureState({
                captureSpecs: page.captureSpecs,
                safeArea: band(0, 100),
            });

            browserSideScreenshooter.call.onCall(0).resolves(page).onCall(1).resolves(state);

            await screenShooter.capture(".element", { compositeImage: false });

            assert.calledOnce(camera.captureViewportImage);
            assert.deepEqual(browserSideScreenshooter.call.getCall(1).args, [
                "getCaptureState",
                [[".element"], [], undefined, []],
            ]);
        });

        it("should capture more than one chunk and restore the initial scroll position", async () => {
            const page = createMockPage({
                viewportSize: size(100, 200),
                captureSpecs: [captureSpec(rect(0, 0, 100, 150))],
                safeArea: band(0, 100),
                scrollOffset: 0,
            });
            const firstState = createCaptureState({
                captureSpecs: page.captureSpecs,
                safeArea: band(0, 100),
                scrollOffset: 0,
            });
            const secondState = createCaptureState({
                captureSpecs: page.captureSpecs,
                safeArea: band(0, 150),
                scrollOffset: 100,
            });

            browserSideScreenshooter.call
                .onCall(0)
                .resolves(page)
                .onCall(1)
                .resolves(firstState)
                .onCall(2)
                .resolves({ debugLog: "scroll debug" })
                .onCall(3)
                .resolves(secondState)
                .onCall(4)
                .resolves({ debugLog: "restore debug" });

            await screenShooter.capture(".element", { compositeImage: true });

            assert.calledTwice(camera.captureViewportImage);
            assert.calledTwice(compositeImage.registerViewportImageAtOffset);
            assert.deepEqual(browserSideScreenshooter.call.getCall(2).args, [
                "scrollBy",
                [[".element"], 100, undefined, []],
            ]);
            assert.deepEqual(browserSideScreenshooter.call.getCall(4).args, [
                "scrollTo",
                [[".element"], 0, undefined, []],
            ]);
        });

        it("should reject with CaptureAreaMovedError when capture area size changes and retries are disabled", async () => {
            const page = createMockPage({
                captureSpecs: [captureSpec(rect(0, 0, 100, 80))],
            });
            const changedState = createCaptureState({
                captureSpecs: [captureSpec(rect(0, 0, 100, 120))],
            });

            browserSideScreenshooter.call.onCall(0).resolves(page).onCall(1).resolves(changedState);

            const error = await screenShooter.capture(".element", { compositeImage: true }, 1).catch(e => e);

            assert.instanceOf(error, CaptureAreaMovedError);
        });

        it("should warn when the captured area still overflows the viewport and allowViewportOverflow is false", async () => {
            const consoleWarnStub = sandbox.stub(console, "warn");
            const page = createMockPage({
                viewportSize: size(100, 100),
                captureSpecs: [captureSpec(rect(0, 0, 100, 150))],
                readableSelectorToScrollDescr: "auto-scroll-parent",
            });
            const state = createCaptureState({
                captureSpecs: page.captureSpecs,
                safeArea: band(0, 100),
            });

            browserSideScreenshooter.call.onCall(0).resolves(page).onCall(1).resolves(state);

            await screenShooter.capture([".element1", ".element2"], {
                compositeImage: false,
                allowViewportOverflow: false,
                debugId: "test-screenshot",
            });

            assert.calledOnce(consoleWarnStub);
            const warningMessage = consoleWarnStub.firstCall.args[0];
            assert.include(warningMessage, "test-screenshot");
            assert.include(warningMessage, ".element1; .element2");
            assert.include(warningMessage, "auto-scroll-parent");
            assert.include(warningMessage, "allowViewportOverflow");
        });

        it("should not warn when allowViewportOverflow is true", async () => {
            const consoleWarnStub = sandbox.stub(console, "warn");
            const page = createMockPage({
                viewportSize: size(100, 100),
                captureSpecs: [captureSpec(rect(0, 0, 100, 150))],
            });
            const state = createCaptureState({
                captureSpecs: page.captureSpecs,
                safeArea: band(0, 100),
            });

            browserSideScreenshooter.call.onCall(0).resolves(page).onCall(1).resolves(state);

            await screenShooter.capture(".element", {
                compositeImage: false,
                allowViewportOverflow: true,
            });

            assert.notCalled(consoleWarnStub);
        });

        it("should propagate camera errors", async () => {
            const page = createMockPage();
            const state = createCaptureState({
                captureSpecs: page.captureSpecs,
                ignoreAreas: page.ignoreAreas,
                safeArea: page.safeArea,
            });
            const error = new Error("Capture failed");

            browserSideScreenshooter.call.onCall(0).resolves(page).onCall(1).resolves(state);
            camera.captureViewportImage.rejects(error);

            await assert.isRejected(screenShooter.capture(".element", { compositeImage: true }), /Capture failed/);
        });

        it("should cleanup scrolls, animations and pointer events according to options", async () => {
            const page = createMockPage();
            const state = createCaptureState({
                captureSpecs: page.captureSpecs,
                ignoreAreas: page.ignoreAreas,
                safeArea: page.safeArea,
            });

            browserSideScreenshooter.call.onCall(0).resolves(page).onCall(1).resolves(state);

            await screenShooter.capture(".element", {
                disableAnimation: true,
                disableHover: "always",
            });

            assert.calledOnceWithExactly(operationsStubs.cleanupScrolls, browserSideScreenshooter);
            assert.calledOnceWithExactly(
                operationsStubs.cleanupPageAnimations,
                browser,
                browserSideScreenshooter,
                true,
            );
            assert.calledOnceWithExactly(operationsStubs.cleanupPointerEvents, browserSideScreenshooter);
        });
    });
});
