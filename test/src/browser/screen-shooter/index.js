"use strict";

const proxyquire = require("proxyquire").noCallThru();

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
    waitForSelectorsToSettle: sinon.stub(),
};

const clientBridgeCreateStub = sinon.stub();
const compositeImageCreateStub = sinon.stub();
const { waitForSelectorsToSettle } = proxyquire("src/browser/screen-shooter/operations/wait-for-selectors-to-settle", {
    "node:timers": {
        setTimeout: fn => {
            fn();

            return { unref: () => {} };
        },
    },
});

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
                anchorShift: null,
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

    const stubSuccessfulCapture = ({ page = createMockPage(), opts = {}, target = ".element" } = {}) => {
        browserSideScreenshooter.call.resolves(page);

        const captureResult = {
            render: sandbox.stub().resolves(renderedImage),
        };

        sandbox.stub(screenShooter, "_performCaptureAttempt").resolves(captureResult);
        sandbox.stub(screenShooter, "_cleanupScreenshot").resolves();

        return screenShooter.capture(target, opts);
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
            execute: sandbox.stub().resolves({ setTimeoutStubbed: false }),
            getTimeouts: sandbox.stub().resolves({ implicit: 0, pageLoad: 300000, script: 30000 }),
            setTimeout: sandbox.stub().resolves(),
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

        it("should accept an element target", async () => {
            const element = { elementId: "element-id" };

            await stubSuccessfulCapture({ target: element });

            const [method, args] = browserSideScreenshooter.call.firstCall.args;
            assert.equal(method, "prepareElementsScreenshot");
            assert.strictEqual(args[0][0], element);
            assert.calledWith(validationStubs.assertCorrectCaptureAreaBounds, JSON.stringify(["element (element-id)"]));
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

        it("should throw if no targets were passed", async () => {
            await assert.isRejected(
                screenShooter.capture([]),
                /No targets to capture passed to ElementsScreenShooter\.capture/,
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

        it("should preload and do best-effort capture when capture area size changes mid-capture", async () => {
            const page = createMockPage({ captureSpecs: [captureSpec(rect(0, 0, 100, 80))] });
            const changedState = createCaptureState({ captureSpecs: [captureSpec(rect(0, 0, 100, 120))] });
            const preloadState = createCaptureState({ captureSpecs: [captureSpec(rect(0, 0, 100, 120))] });
            const settledState = createCaptureState({ captureSpecs: page.captureSpecs, safeArea: page.safeArea });

            browserSideScreenshooter.call
                .onCall(0)
                .resolves(page) // prepareElementsScreenshot
                .onCall(1)
                .resolves(changedState) // getCaptureState phase 1 → size change
                .onCall(2)
                .resolves(preloadState) // getCaptureState in preload
                .onCall(3)
                .resolves({}) // scrollTo restore after preload
                .onCall(4)
                .resolves(undefined) // captureAnchorBaseline
                .onCall(5)
                .resolves(settledState); // getCaptureState phase 2

            const result = await screenShooter.capture(".element", { compositeImage: false });

            assert.deepEqual(
                browserSideScreenshooter.call
                    .getCalls()
                    .map(call => call.args[0])
                    .filter(m => m === "prepareElementsScreenshot"),
                ["prepareElementsScreenshot"],
            );
            assert.deepEqual(
                browserSideScreenshooter.call
                    .getCalls()
                    .map(call => call.args[0])
                    .filter(m => m === "captureAnchorBaseline"),
                ["captureAnchorBaseline"],
            );
            assert.calledOnce(camera.captureViewportImage);
            assert.deepEqual(result, { image: renderedImage, meta: page });
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
            assert.include(error.message, 'elements: [".element"]');
            assert.include(error.message, '"allowViewportOverflow":true');
            assert.include(error.message, "error: boom");
        });

        it("should capture viewport image with viewport parameters and screenshot delay", async () => {
            const page = createMockPage();
            const state = createCaptureState({
                captureSpecs: page.captureSpecs,
                viewportOffset: page.viewportOffset,
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
                cropMargins: undefined,
            });
            assert.calledOnceWithExactly(
                compositeImage.registerViewportImageAtOffset,
                viewportImage,
                state.safeArea,
                state.captureSpecs,
                state.ignoreAreas,
                0,
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
                scrollOffset: 50,
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
                [[".element"], 50, undefined, []],
            ]);
            assert.deepEqual(browserSideScreenshooter.call.getCall(4).args, [
                "scrollTo",
                [[".element"], 0, undefined, []],
            ]);
        });

        it("should pass correction delta to registerViewportImageAtOffset during best-effort pass", async () => {
            const page = createMockPage({ captureSpecs: [captureSpec(rect(0, 34, 100, 80))], scrollOffset: 0 });
            const changedState = createCaptureState({ captureSpecs: [captureSpec(rect(0, 34, 100, 120))] });
            const preloadState = createCaptureState({ captureSpecs: [captureSpec(rect(0, 34, 100, 120))] });
            const settledState = createCaptureState({
                captureSpecs: [captureSpec(rect(0, -246, 100, 80))],
                scrollOffset: 280,
                anchorShift: -287,
            });

            browserSideScreenshooter.call
                .onCall(0)
                .resolves(page)
                .onCall(1)
                .resolves(changedState)
                .onCall(2)
                .resolves(preloadState)
                .onCall(3)
                .resolves({})
                .onCall(4)
                .resolves(undefined)
                .onCall(5)
                .resolves(settledState)
                .onCall(6)
                .resolves({ debugLog: "restore debug" });

            await screenShooter.capture(".element", { compositeImage: false });

            assert.calledOnceWithExactly(
                compositeImage.registerViewportImageAtOffset,
                viewportImage,
                settledState.safeArea,
                settledState.captureSpecs,
                settledState.ignoreAreas,
                -7,
            );
        });

        it("should pass zero correction when observed shift is unavailable", async () => {
            const page = createMockPage({ captureSpecs: [captureSpec(rect(0, 34, 100, 80))], scrollOffset: 0 });
            const changedState = createCaptureState({ captureSpecs: [captureSpec(rect(0, 34, 100, 120))] });
            const preloadState = createCaptureState({ captureSpecs: [captureSpec(rect(0, 34, 100, 120))] });
            const settledState = createCaptureState({
                captureSpecs: [captureSpec(rect(0, -246, 100, 80))],
                scrollOffset: 280,
                anchorShift: null,
            });

            browserSideScreenshooter.call
                .onCall(0)
                .resolves(page)
                .onCall(1)
                .resolves(changedState)
                .onCall(2)
                .resolves(preloadState)
                .onCall(3)
                .resolves({})
                .onCall(4)
                .resolves(undefined)
                .onCall(5)
                .resolves(settledState)
                .onCall(6)
                .resolves({ debugLog: "restore debug" });

            await screenShooter.capture(".element", { compositeImage: false });

            assert.calledOnceWithExactly(
                compositeImage.registerViewportImageAtOffset,
                viewportImage,
                settledState.safeArea,
                settledState.captureSpecs,
                settledState.ignoreAreas,
                0,
            );
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

    describe("waitForSelectorsToSettle", () => {
        it("should pass element targets to browser-side polling", async () => {
            const element = { elementId: "element-id" };
            browser.execute.resolves({ success: true });

            await waitForSelectorsToSettle(browser, [element]);

            assert.strictEqual(browser.execute.firstCall.args[1][0], element);
        });

        it("should fall back to Node-side polling when browser-side code detects stubbed setTimeout", async () => {
            browser.execute
                .onCall(0)
                .resolves({ success: false })
                .onCall(1)
                .resolves([{ top: 1, height: 2 }])
                .onCall(2)
                .resolves([{ top: 1, height: 2 }])
                .onCall(3)
                .resolves([{ top: 1, height: 2 }])
                .onCall(4)
                .resolves([{ top: 1, height: 2 }]);

            await waitForSelectorsToSettle(browser, [".element"]);

            assert.calledOnce(browser.getTimeouts);
            assert.calledTwice(browser.setTimeout);
            assert.calledWithExactly(browser.setTimeout.firstCall, { script: 3000 });
            assert.calledWithExactly(browser.setTimeout.secondCall, { script: 30000 });
            assert.callCount(browser.execute, 5);
        });

        it("should use Node-side polling when browser needs compat lib", async () => {
            browser.execute.resolves([{ top: 1, height: 2 }]);

            await waitForSelectorsToSettle(browser, [".element"], { needsCompatLib: true });

            assert.notCalled(browser.getTimeouts);
            assert.notCalled(browser.setTimeout);
            assert.callCount(browser.execute, 4);
        });

        it("should pass element targets to Node-side polling", async () => {
            const element = { elementId: "element-id" };
            browser.execute.resolves([{ top: 1, height: 2 }]);

            await waitForSelectorsToSettle(browser, [element], { needsCompatLib: true });

            for (const call of browser.execute.getCalls()) {
                assert.strictEqual(call.args[1][0], element);
            }
        });

        it("should resolve XPath targets during Node-side polling", async () => {
            const previousDocument = global.document;
            const previousXPathResult = global.XPathResult;
            const element = { getBoundingClientRect: () => ({ top: 1, height: 2 }) };
            const evaluate = sandbox.stub().returns({ singleNodeValue: element });
            global.document = { evaluate };
            global.XPathResult = { FIRST_ORDERED_NODE_TYPE: 9 };
            browser.execute.callsFake((script, targets) => script(targets));

            try {
                await waitForSelectorsToSettle(browser, ["//main"], { needsCompatLib: true });
            } finally {
                global.document = previousDocument;
                global.XPathResult = previousXPathResult;
            }

            assert.callCount(evaluate, 4);
        });

        it("should fall back to Node-side polling when browser-side code hits script timeout", async () => {
            const scriptTimeoutError = new Error("script timeout");

            browser.execute
                .onCall(0)
                .rejects(scriptTimeoutError)
                .onCall(1)
                .resolves([{ top: 1, height: 2 }])
                .onCall(2)
                .resolves([{ top: 1, height: 2 }])
                .onCall(3)
                .resolves([{ top: 1, height: 2 }])
                .onCall(4)
                .resolves([{ top: 1, height: 2 }]);

            await waitForSelectorsToSettle(browser, [".element"]);

            assert.calledTwice(browser.setTimeout);
            assert.calledWithExactly(browser.setTimeout.firstCall, { script: 3000 });
            assert.calledWithExactly(browser.setTimeout.secondCall, { script: 30000 });
            assert.callCount(browser.execute, 5);
        });

        it("should not override script timeout if getTimeouts is not available", async () => {
            delete browser.getTimeouts;
            browser.execute.resolves({ success: true });

            await waitForSelectorsToSettle(browser, [".element"]);

            assert.notCalled(browser.setTimeout);
            assert.calledOnce(browser.execute);
        });

        it("should propagate non-timeout browser-side errors", async () => {
            browser.execute.rejects(new Error("boom"));

            await assert.isRejected(waitForSelectorsToSettle(browser, [".element"]), /boom/);

            assert.calledTwice(browser.setTimeout);
            assert.calledOnce(browser.execute);
        });
    });
});
