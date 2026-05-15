import sinon, { SinonStub } from "sinon";
import proxyquire from "proxyquire";
import type { ExistingBrowser } from "src/browser/existing-browser";
import type { Test } from "src/types";
import { SelectivityMode, type SelectivityModeValue } from "src/config/types";

describe("CDP/Selectivity", () => {
    const sandbox = sinon.createSandbox();
    let startSelectivity: typeof import("src/browser/cdp/selectivity/index").startSelectivity;
    let updateSelectivityHashes: typeof import("src/browser/cdp/selectivity/index").updateSelectivityHashes;
    let clearUnusedSelectivityDumps: typeof import("src/browser/cdp/selectivity/index").clearUnusedSelectivityDumps;

    let CSSSelectivityStub: SinonStub;
    let JSSelectivityStub: SinonStub;
    let getTestDependenciesWriterStub: SinonStub;
    let getHashWriterStub: SinonStub;
    let getHashReaderStub: SinonStub;
    let getTestDependenciesReaderStub: SinonStub;
    let transformSourceDependenciesStub: SinonStub;
    let debugSelectivityStub: SinonStub;
    let getSelectivityTestsPathStub: SinonStub;
    let getUsedDumpsTrackerStub: SinonStub;
    let usedDumpsTrackerMock: { usedDumpsFor: SinonStub; wasUsed: SinonStub; trackUsed: SinonStub };
    let fsStub: {
        access: SinonStub;
        readdir: SinonStub;
        unlink: SinonStub;
        constants: { R_OK: number; W_OK: number };
    };

    let cssSelectivityMock: { start: SinonStub; stop: SinonStub; takeCoverageSnapshot: SinonStub };
    let jsSelectivityMock: { start: SinonStub; stop: SinonStub; takeCoverageSnapshot: SinonStub };
    let testDependenciesWriterMock: { saveFor: SinonStub };
    let hashWriterMock: { addTestDependencyHashes: SinonStub; addPatternDependencyHash: SinonStub; save: SinonStub };
    let hashReaderMock: { patternHasChanged: SinonStub; getTestChangedDeps: SinonStub };
    let testDepsReaderMock: { getFor: SinonStub };

    let browserMock: {
        config: {
            selectivity: {
                enabled: SelectivityModeValue;
                saveIncompleteDumpOnFail: false;
                sourceRoot: string;
                testDependenciesPath: string;
                compression: "none";
                disableSelectivityPatterns: string[];
                mapDependencyRelativePath: null;
                mapSourceMapUrl: null;
            };
        };
        publicAPI: { isChromium: boolean; getWindowHandle: SinonStub };
        cdp: {
            target: {
                getTargets: SinonStub;
                attachToTarget: SinonStub;
                detachFromTarget: SinonStub;
                setAutoAttach: SinonStub;
            };
            dom: { enable: SinonStub };
            css: { enable: SinonStub };
            debugger: { enable: SinonStub; on: SinonStub; off: SinonStub; resume: SinonStub };
            page: { enable: SinonStub; addScriptToEvaluateOnNewDocument: SinonStub };
            profiler: { enable: SinonStub };
        } | null;
    };

    beforeEach(() => {
        cssSelectivityMock = {
            start: sandbox.stub().resolves(),
            stop: sandbox.stub().resolves(new Set(["src/styles.css"])),
            takeCoverageSnapshot: sandbox.stub().resolves(),
        };
        jsSelectivityMock = {
            start: sandbox.stub().resolves(),
            stop: sandbox.stub().resolves(new Set(["src/app.js"])),
            takeCoverageSnapshot: sandbox.stub().resolves(),
        };
        testDependenciesWriterMock = {
            saveFor: sandbox.stub().resolves(),
        };
        hashWriterMock = {
            addTestDependencyHashes: sandbox.stub(),
            addPatternDependencyHash: sandbox.stub(),
            save: sandbox.stub().resolves(),
        };
        hashReaderMock = {
            patternHasChanged: sandbox.stub(),
            getTestChangedDeps: sandbox.stub(),
        };
        testDepsReaderMock = {
            getFor: sandbox.stub(),
        };

        fsStub = {
            access: sandbox.stub().resolves(),
            readdir: sandbox.stub().resolves([]),
            unlink: sandbox.stub().resolves(),
            constants: { R_OK: 4, W_OK: 2 },
        };

        usedDumpsTrackerMock = {
            usedDumpsFor: sandbox.stub().returns(false),
            wasUsed: sandbox.stub().returns(false),
            trackUsed: sandbox.stub(),
        };
        getUsedDumpsTrackerStub = sandbox.stub().returns(usedDumpsTrackerMock);

        CSSSelectivityStub = sandbox.stub().returns(cssSelectivityMock);
        JSSelectivityStub = sandbox.stub().returns(jsSelectivityMock);
        getTestDependenciesWriterStub = sandbox.stub().returns(testDependenciesWriterMock);
        getHashWriterStub = sandbox.stub().returns(hashWriterMock);
        getHashReaderStub = sandbox.stub().returns(hashReaderMock);
        getTestDependenciesReaderStub = sandbox.stub().returns(testDepsReaderMock);
        transformSourceDependenciesStub = sandbox.stub().returns({
            css: ["src/styles.css"],
            js: ["src/app.js"],
            modules: ["node_modules/react"],
        });
        debugSelectivityStub = sandbox.stub();
        getSelectivityTestsPathStub = sandbox.stub().callsFake((path: string) => `${path}/tests`);

        browserMock = {
            config: {
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    saveIncompleteDumpOnFail: false,
                    sourceRoot: "/test/source-root",
                    testDependenciesPath: "/test/dependencies",
                    compression: "none",
                    disableSelectivityPatterns: [],
                    mapDependencyRelativePath: null,
                    mapSourceMapUrl: null,
                },
            },
            publicAPI: {
                isChromium: true,
                getWindowHandle: sandbox.stub().resolves("CDwindow-target-123"),
            },
            cdp: {
                target: {
                    getTargets: sandbox.stub().resolves({
                        targetInfos: [{ targetId: "target-123" }],
                    }),
                    attachToTarget: sandbox.stub().resolves({ sessionId: "session-123" }),
                    detachFromTarget: sandbox.stub().resolves(),
                    setAutoAttach: sandbox.stub().resolves(),
                },
                dom: { enable: sandbox.stub().resolves() },
                css: { enable: sandbox.stub().resolves() },
                debugger: {
                    enable: sandbox.stub().resolves(),
                    on: sandbox.stub(),
                    off: sandbox.stub(),
                    resume: sandbox.stub().resolves(),
                },
                page: {
                    enable: sandbox.stub().resolves(),
                    addScriptToEvaluateOnNewDocument: sandbox.stub().resolves(),
                },
                profiler: { enable: sandbox.stub().resolves() },
            },
        };

        const proxyquiredModule = proxyquire("src/browser/cdp/selectivity/index", {
            "./css-selectivity": { CSSSelectivity: CSSSelectivityStub },
            "./js-selectivity": { JSSelectivity: JSSelectivityStub },
            "./test-dependencies-writer": { getTestDependenciesWriter: getTestDependenciesWriterStub },
            "./hash-writer": { getHashWriter: getHashWriterStub },
            "./hash-reader": { getHashReader: getHashReaderStub },
            "./test-dependencies-reader": { getTestDependenciesReader: getTestDependenciesReaderStub },
            "./utils": {
                transformSourceDependencies: transformSourceDependenciesStub,
                getSelectivityTestsPath: getSelectivityTestsPathStub,
            },
            "./debug": { debugSelectivity: debugSelectivityStub },
            "./used-dumps-tracker": { getUsedDumpsTracker: getUsedDumpsTrackerStub },
            "fs-extra": fsStub,
        });

        startSelectivity = proxyquiredModule.startSelectivity;
        updateSelectivityHashes = proxyquiredModule.updateSelectivityHashes;
        clearUnusedSelectivityDumps = proxyquiredModule.clearUnusedSelectivityDumps;
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("startSelectivity", () => {
        [SelectivityMode.Disabled, SelectivityMode.ReadOnly].forEach(mode => {
            it(`should return no-op function if selectivity mode is ${mode}`, async () => {
                browserMock.config.selectivity.enabled = mode;

                const stopFn = await startSelectivity(browserMock as unknown as ExistingBrowser);

                assert.isFunction(stopFn);

                await stopFn({ id: "test", browserId: "chrome" } as Test, true);

                assert.notCalled(CSSSelectivityStub);
                assert.notCalled(JSSelectivityStub);
            });
        });

        it("should return no-op function if browser is not Chromium", async () => {
            browserMock.publicAPI.isChromium = false;

            const stopFn = await startSelectivity(browserMock as unknown as ExistingBrowser);

            assert.isFunction(stopFn);

            await stopFn({ id: "test", browserId: "chrome" } as Test, true);

            assert.notCalled(CSSSelectivityStub);
            assert.notCalled(JSSelectivityStub);
        });

        it("should throw error if CDP connection is not established", async () => {
            browserMock.cdp = null;

            await assert.isRejected(
                startSelectivity(browserMock as unknown as ExistingBrowser),
                /Selectivity: Devtools connection is not established, couldn't record selectivity without it/,
            );
        });

        it("should throw error if target ID is not found", async () => {
            browserMock.publicAPI.getWindowHandle.resolves("unknown-handle");
            browserMock.cdp!.target.getTargets.resolves({
                targetInfos: [{ targetId: "different-target" }],
            });

            await assert.isRejected(
                startSelectivity(browserMock as unknown as ExistingBrowser),
                /Selectivity: Couldn't find current page/,
            );
        });

        it("should start CSS and JS selectivity and return stop function", async () => {
            const stopFn = await startSelectivity(browserMock as unknown as ExistingBrowser);

            assert.calledWith(browserMock.cdp!.target.getTargets);
            assert.calledWith(browserMock.cdp!.target.attachToTarget, "target-123");
            assert.calledWith(CSSSelectivityStub, browserMock.cdp, "session-123", "/test/source-root");
            assert.calledWith(JSSelectivityStub, browserMock.cdp, "session-123", "/test/source-root");
            assert.calledOnce(cssSelectivityMock.start);
            assert.calledOnce(jsSelectivityMock.start);
            assert.isFunction(stopFn);
        });

        it("should enable CDP domains before starting selectivity", async () => {
            await startSelectivity(browserMock as unknown as ExistingBrowser);

            assert.calledWith(browserMock.cdp!.dom.enable, "session-123");
            assert.calledWith(browserMock.cdp!.css.enable, "session-123");
            assert.calledWith(browserMock.cdp!.target.setAutoAttach, "session-123", {
                autoAttach: true,
                waitForDebuggerOnStart: false,
            });
            assert.calledWith(browserMock.cdp!.debugger.enable, "session-123");
            assert.calledWith(browserMock.cdp!.page.enable, "session-123");
            assert.calledWith(browserMock.cdp!.profiler.enable, "session-123");
        });

        it("should register debugger paused handler and add beforeunload script", async () => {
            await startSelectivity(browserMock as unknown as ExistingBrowser);

            assert.calledOnceWith(browserMock.cdp!.debugger.on, "paused");
            assert.calledOnceWith(browserMock.cdp!.page.addScriptToEvaluateOnNewDocument, "session-123", {
                source: sinon.match.string,
            });
            assert.include(
                browserMock.cdp!.page.addScriptToEvaluateOnNewDocument.args[0][1].source,
                'window.addEventListener("beforeunload", function',
            );
        });

        it("should take coverage snapshots when debugger pauses on beforeunload handler", async () => {
            await startSelectivity(browserMock as unknown as ExistingBrowser);

            const pausedHandler = browserMock.cdp!.debugger.on.getCall(0).args[1];

            pausedHandler({ callFrames: [{ functionName: "__testplane_cdp_coverage_snapshot_pause" }] }, "session-123");

            // Need to let the promise chain resolve
            await new Promise(resolve => setTimeout(resolve, 10));

            assert.calledOnce(cssSelectivityMock.takeCoverageSnapshot);
            assert.calledOnce(jsSelectivityMock.takeCoverageSnapshot);
            assert.calledWith(browserMock.cdp!.debugger.resume, "session-123");
        });

        it("should ignore debugger paused events from different sessions", async () => {
            await startSelectivity(browserMock as unknown as ExistingBrowser);

            const pausedHandler = browserMock.cdp!.debugger.on.getCall(0).args[1];

            pausedHandler(
                { callFrames: [{ functionName: "__testplane_cdp_coverage_snapshot_pause" }] },
                "different-session",
            );

            await new Promise(resolve => setTimeout(resolve, 10));

            assert.notCalled(cssSelectivityMock.takeCoverageSnapshot);
            assert.notCalled(jsSelectivityMock.takeCoverageSnapshot);
        });

        it("should ignore debugger paused events with non-matching function name", async () => {
            await startSelectivity(browserMock as unknown as ExistingBrowser);

            const pausedHandler = browserMock.cdp!.debugger.on.getCall(0).args[1];

            pausedHandler({ callFrames: [{ functionName: "someOtherFunction" }] }, "session-123");

            await new Promise(resolve => setTimeout(resolve, 10));

            assert.notCalled(cssSelectivityMock.takeCoverageSnapshot);
            assert.notCalled(jsSelectivityMock.takeCoverageSnapshot);
        });

        it("should handle window handle containing target ID", async () => {
            browserMock.publicAPI.getWindowHandle.resolves("CDwindow-target-123-suffix");
            browserMock.cdp!.target.getTargets.resolves({
                targetInfos: [{ targetId: "target-123" }],
            });

            const stopFn = await startSelectivity(browserMock as unknown as ExistingBrowser);

            assert.isFunction(stopFn);
            assert.calledWith(browserMock.cdp!.target.attachToTarget, "target-123");
        });
    });

    describe("stopSelectivity", () => {
        let stopFn: any;
        const mockTest = { id: "test-123", browserId: "chrome" };

        beforeEach(async () => {
            stopFn = await startSelectivity(browserMock as unknown as ExistingBrowser);
        });

        it("should stop selectivity and not save when drop is true", async () => {
            await stopFn(mockTest, true);

            assert.calledWith(cssSelectivityMock.stop, true);
            assert.calledWith(jsSelectivityMock.stop, true);
            assert.calledWith(browserMock.cdp!.target.detachFromTarget, "session-123");
            assert.notCalled(testDependenciesWriterMock.saveFor);
            assert.notCalled(hashWriterMock.addTestDependencyHashes);
            assert.notCalled(hashWriterMock.save);
        });

        it("should stop selectivity and save dependencies when drop is false", async () => {
            await stopFn(mockTest, false);

            assert.calledWith(cssSelectivityMock.stop, false);
            assert.calledWith(jsSelectivityMock.stop, false);
            assert.calledWith(
                transformSourceDependenciesStub,
                { css: new Set(["src/styles.css"]), js: new Set(["src/app.js"]), png: null },
                null,
                "browser",
            );
            assert.calledWith(
                transformSourceDependenciesStub,
                { css: null, js: sinon.match.any, png: sinon.match.any },
                null,
                "testplane",
            );
            assert.calledWith(getTestDependenciesWriterStub, "/test/dependencies");
            assert.calledWith(testDependenciesWriterMock.saveFor, mockTest, {
                css: ["src/styles.css"],
                js: ["src/app.js"],
                modules: ["node_modules/react"],
            });
        });

        it("should not save when no dependencies are found", async () => {
            cssSelectivityMock.stop.resolves(new Set());
            jsSelectivityMock.stop.resolves(new Set());

            await stopFn(mockTest, false);

            assert.notCalled(testDependenciesWriterMock.saveFor);
            assert.notCalled(hashWriterMock.addTestDependencyHashes);
            assert.notCalled(hashWriterMock.save);
        });

        it("should handle CDP detach errors gracefully", async () => {
            browserMock.cdp!.target.detachFromTarget.rejects(new Error("Detach failed"));

            await stopFn(mockTest, false);

            assert.calledWith(browserMock.cdp!.target.detachFromTarget, "session-123");
        });

        it("should handle CSS selectivity errors", async () => {
            cssSelectivityMock.stop.rejects(new Error("CSS error"));

            await assert.isRejected(stopFn(mockTest, false), "CSS error");
        });

        it("should handle JS selectivity errors", async () => {
            jsSelectivityMock.stop.rejects(new Error("JS error"));

            await assert.isRejected(stopFn(mockTest, false), "JS error");
        });

        it("should handle test dependencies writer errors", async () => {
            testDependenciesWriterMock.saveFor.rejects(new Error("Save error"));

            await assert.isRejected(stopFn(mockTest, false), "Save error");
        });

        it("should save dependencies when only CSS dependencies exist", async () => {
            jsSelectivityMock.stop.resolves(new Set());

            await stopFn(mockTest, false);

            assert.calledWith(
                transformSourceDependenciesStub,
                { css: new Set(["src/styles.css"]), js: [], png: null },
                null,
                "browser",
            );
            assert.calledOnce(testDependenciesWriterMock.saveFor);
        });

        it("should save dependencies when only JS dependencies exist", async () => {
            cssSelectivityMock.stop.resolves(null);

            await stopFn(mockTest, false);

            assert.calledWith(
                transformSourceDependenciesStub,
                { css: null, js: new Set(["src/app.js"]), png: null },
                null,
                "browser",
            );
            assert.calledOnce(testDependenciesWriterMock.saveFor);
        });

        it("should call transformSourceDependencies with 'browser' scope for browser deps", async () => {
            await stopFn(mockTest, false);

            const browserCall = transformSourceDependenciesStub
                .getCalls()
                .find((call: sinon.SinonSpyCall) => call.args[2] === "browser");

            assert.ok(browserCall, "expected a call with scope 'browser'");
            assert.equal(browserCall!.args[2], "browser");
        });

        it("should call transformSourceDependencies with 'testplane' scope for testplane deps", async () => {
            await stopFn(mockTest, false);

            const testplaneCall = transformSourceDependenciesStub
                .getCalls()
                .find((call: sinon.SinonSpyCall) => call.args[2] === "testplane");

            assert.ok(testplaneCall, "expected a call with scope 'testplane'");
            assert.equal(testplaneCall!.args[2], "testplane");
        });

        it("should pass mapDependencyRelativePath directly to transformSourceDependencies", async () => {
            const mapFn = sinon.stub().returns(true);
            (browserMock.config.selectivity as any).mapDependencyRelativePath = mapFn;

            // startSelectivity captures mapDependencyRelativePath via closure, so we must start a new session
            const customStopFn = await startSelectivity(browserMock as unknown as ExistingBrowser);
            await customStopFn(mockTest as unknown as import("src/types").Test, false);

            assert.calledWith(transformSourceDependenciesStub, sinon.match.any, mapFn, "browser");
            assert.calledWith(transformSourceDependenciesStub, sinon.match.any, mapFn, "testplane");
        });
    });

    describe("updateSelectivityHashes", () => {
        let configMock: {
            getBrowserIds: SinonStub;
            forBrowser: SinonStub;
        };

        beforeEach(() => {
            configMock = {
                getBrowserIds: sandbox.stub(),
                forBrowser: sandbox.stub(),
            };
        });

        [SelectivityMode.Disabled, SelectivityMode.ReadOnly].forEach(mode => {
            it(`should skip browsers with selectivity mode ${mode}`, async () => {
                configMock.getBrowserIds.returns(["chrome", "firefox"]);
                configMock.forBrowser
                    .withArgs("chrome")
                    .returns({
                        lastFailed: { only: false },
                        selectivity: {
                            enabled: mode,
                            saveIncompleteDumpOnFail: false,
                            testDependenciesPath: "/test/path",
                            compression: "none",
                            disableSelectivityPatterns: ["src/**/*.js"],
                        },
                    })
                    .withArgs("firefox")
                    .returns({
                        lastFailed: { only: false },
                        selectivity: {
                            enabled: SelectivityMode.Enabled,
                            saveIncompleteDumpOnFail: false,
                            testDependenciesPath: "/test/path",
                            compression: "none",
                            disableSelectivityPatterns: ["src/**/*.js"],
                        },
                    });

                hashReaderMock.patternHasChanged.resolves(true);

                await updateSelectivityHashes(configMock as any, false);

                assert.calledOnceWith(getHashReaderStub, "/test/path", "none"); // Only for firefox
                assert.calledOnceWith(hashWriterMock.addPatternDependencyHash, "src/**/*.js");
                assert.calledOnce(hashWriterMock.save);
            });
        });

        it("should update hashes for changed patterns", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                lastFailed: { only: false },
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    saveIncompleteDumpOnFail: false,
                    testDependenciesPath: "/test/path",
                    compression: "gz",
                    disableSelectivityPatterns: ["pattern1", "pattern2", "pattern3"],
                },
            });

            hashReaderMock.patternHasChanged
                .withArgs("pattern1")
                .resolves(true)
                .withArgs("pattern2")
                .resolves(false)
                .withArgs("pattern3")
                .resolves(true);

            await updateSelectivityHashes(configMock as any, false);

            assert.calledWith(getHashReaderStub, "/test/path", "gz");
            assert.calledWith(getHashWriterStub, "/test/path", "gz");
            assert.calledTwice(hashWriterMock.addPatternDependencyHash);
            assert.calledWith(hashWriterMock.addPatternDependencyHash.firstCall, "pattern1");
            assert.calledWith(hashWriterMock.addPatternDependencyHash.secondCall, "pattern3");
            assert.calledOnce(hashWriterMock.save);
        });

        it("should not add hashes for unchanged patterns", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                lastFailed: { only: false },
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    saveIncompleteDumpOnFail: false,
                    testDependenciesPath: "/test/path",
                    compression: "none",
                    disableSelectivityPatterns: ["pattern1", "pattern2"],
                },
            });

            hashReaderMock.patternHasChanged.resolves(false);

            await updateSelectivityHashes(configMock as any, false);

            assert.notCalled(hashWriterMock.addPatternDependencyHash);
            assert.calledOnce(hashWriterMock.save); // Still saves even if no patterns changed
        });

        it("should handle multiple browsers", async () => {
            configMock.getBrowserIds.returns(["chrome", "firefox"]);
            configMock.forBrowser
                .withArgs("chrome")
                .returns({
                    lastFailed: { only: false },
                    selectivity: {
                        enabled: SelectivityMode.Enabled,
                        saveIncompleteDumpOnFail: false,
                        testDependenciesPath: "/test/chrome",
                        compression: "none",
                        disableSelectivityPatterns: ["chrome-pattern"],
                    },
                })
                .withArgs("firefox")
                .returns({
                    lastFailed: { only: false },
                    selectivity: {
                        enabled: SelectivityMode.Enabled,
                        saveIncompleteDumpOnFail: false,
                        testDependenciesPath: "/test/firefox",
                        compression: "gz",
                        disableSelectivityPatterns: ["firefox-pattern"],
                    },
                });

            hashReaderMock.patternHasChanged.resolves(true);

            await updateSelectivityHashes(configMock as any, false);

            assert.calledTwice(getHashReaderStub);
            assert.calledWith(getHashReaderStub.firstCall, "/test/chrome", "none");
            assert.calledWith(getHashReaderStub.secondCall, "/test/firefox", "gz");
            assert.calledTwice(hashWriterMock.addPatternDependencyHash);
            assert.calledTwice(hashWriterMock.save);
        });

        it("should update hashes for WriteOnly mode", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                lastFailed: { only: false },
                selectivity: {
                    enabled: SelectivityMode.WriteOnly,
                    saveIncompleteDumpOnFail: false,
                    testDependenciesPath: "/test/path",
                    compression: "none",
                    disableSelectivityPatterns: ["src/**/*.js"],
                },
            });

            hashReaderMock.patternHasChanged.resolves(true);

            await updateSelectivityHashes(configMock as any, false);

            assert.calledOnceWith(hashWriterMock.addPatternDependencyHash, "src/**/*.js");
            assert.calledOnce(hashWriterMock.save);
        });

        it("should skip saving when run is failed and saveIncompleteDumpOnFail is false", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                lastFailed: { only: false },
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    saveIncompleteDumpOnFail: false,
                    testDependenciesPath: "/test/path",
                    compression: "none",
                    disableSelectivityPatterns: [],
                },
            });

            await updateSelectivityHashes(configMock as any, true);

            assert.notCalled(getHashReaderStub);
            assert.notCalled(getHashWriterStub);
            assert.notCalled(hashWriterMock.save);
        });

        it("should save when run is failed and saveIncompleteDumpOnFail is true", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                lastFailed: { only: false },
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    saveIncompleteDumpOnFail: true,
                    testDependenciesPath: "/test/path",
                    compression: "none",
                    disableSelectivityPatterns: [],
                },
            });

            await updateSelectivityHashes(configMock as any, true);

            assert.calledOnce(hashWriterMock.save);
        });

        it("should skip saving when lastFailed.only is true and saveIncompleteDumpOnFail is false", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                lastFailed: { only: true },
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    saveIncompleteDumpOnFail: false,
                    testDependenciesPath: "/test/path",
                    compression: "none",
                    disableSelectivityPatterns: [],
                },
            });

            await updateSelectivityHashes(configMock as any, false);

            assert.notCalled(getHashReaderStub);
            assert.notCalled(getHashWriterStub);
            assert.notCalled(hashWriterMock.save);
        });

        it("should save when lastFailed.only is true and saveIncompleteDumpOnFail is true", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                lastFailed: { only: true },
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    saveIncompleteDumpOnFail: true,
                    testDependenciesPath: "/test/path",
                    compression: "none",
                    disableSelectivityPatterns: [],
                },
            });

            await updateSelectivityHashes(configMock as any, false);

            assert.calledOnce(hashWriterMock.save);
        });
    });

    describe("clearUnusedSelectivityDumps", () => {
        let configMock: {
            getBrowserIds: SinonStub;
            forBrowser: SinonStub;
        };

        beforeEach(() => {
            configMock = {
                getBrowserIds: sandbox.stub(),
                forBrowser: sandbox.stub(),
            };
        });

        it("should skip browsers with selectivity disabled", async () => {
            configMock.getBrowserIds.returns(["chrome", "firefox"]);
            configMock.forBrowser
                .withArgs("chrome")
                .returns({
                    lastFailed: { only: false },
                    selectivity: {
                        enabled: SelectivityMode.Disabled,
                        saveIncompleteDumpOnFail: false,
                        testDependenciesPath: "/test/chrome",
                    },
                })
                .withArgs("firefox")
                .returns({
                    lastFailed: { only: false },
                    selectivity: {
                        enabled: SelectivityMode.Disabled,
                        saveIncompleteDumpOnFail: false,
                        testDependenciesPath: "/test/firefox",
                    },
                });

            await clearUnusedSelectivityDumps(configMock as any, false);

            assert.notCalled(usedDumpsTrackerMock.usedDumpsFor);
            assert.notCalled(getSelectivityTestsPathStub);
            assert.notCalled(fsStub.access);
            assert.notCalled(fsStub.readdir);
        });

        it("should skip browsers with selectivity in read-only mode", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                lastFailed: { only: false },
                selectivity: {
                    enabled: SelectivityMode.ReadOnly,
                    saveIncompleteDumpOnFail: false,
                    testDependenciesPath: "/test/deps",
                },
            });

            await clearUnusedSelectivityDumps(configMock as any, false);

            assert.notCalled(usedDumpsTrackerMock.usedDumpsFor);
            assert.notCalled(getSelectivityTestsPathStub);
            assert.notCalled(fsStub.access);
        });

        it("should skip selectivity root when no dumps were used for it", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                lastFailed: { only: false },
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    saveIncompleteDumpOnFail: false,
                    testDependenciesPath: "/test/deps",
                },
            });

            usedDumpsTrackerMock.usedDumpsFor.withArgs("/test/deps").returns(false);

            await clearUnusedSelectivityDumps(configMock as any, false);

            assert.calledOnceWith(usedDumpsTrackerMock.usedDumpsFor, "/test/deps");
            assert.notCalled(getSelectivityTestsPathStub);
            assert.notCalled(fsStub.access);
            assert.notCalled(fsStub.readdir);
        });

        it("should process single browser with selectivity enabled", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                lastFailed: { only: false },
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    saveIncompleteDumpOnFail: false,
                    testDependenciesPath: "/test/deps",
                },
            });

            usedDumpsTrackerMock.usedDumpsFor.returns(true);
            fsStub.access.resolves();
            fsStub.readdir.resolves([]);

            await clearUnusedSelectivityDumps(configMock as any, false);

            assert.calledOnceWith(getSelectivityTestsPathStub, "/test/deps");
            assert.calledOnceWith(fsStub.access, "/test/deps/tests", 6); // R_OK | W_OK = 4 | 2 = 6
            assert.calledOnceWith(fsStub.readdir, "/test/deps/tests");
        });

        it("should process multiple browsers with same selectivity root only once", async () => {
            configMock.getBrowserIds.returns(["chrome", "firefox"]);
            configMock.forBrowser
                .withArgs("chrome")
                .returns({
                    lastFailed: { only: false },
                    selectivity: {
                        enabled: SelectivityMode.Enabled,
                        saveIncompleteDumpOnFail: false,
                        testDependenciesPath: "/test/shared",
                    },
                })
                .withArgs("firefox")
                .returns({
                    lastFailed: { only: false },
                    selectivity: {
                        enabled: SelectivityMode.Enabled,
                        saveIncompleteDumpOnFail: false,
                        testDependenciesPath: "/test/shared",
                    },
                });

            usedDumpsTrackerMock.usedDumpsFor.returns(true);
            fsStub.access.resolves();
            fsStub.readdir.resolves([]);

            await clearUnusedSelectivityDumps(configMock as any, false);

            assert.calledOnceWith(getSelectivityTestsPathStub, "/test/shared");
            assert.calledOnce(fsStub.access);
            assert.calledOnce(fsStub.readdir);
        });

        it("should process multiple browsers with different selectivity roots", async () => {
            configMock.getBrowserIds.returns(["chrome", "firefox"]);
            configMock.forBrowser
                .withArgs("chrome")
                .returns({
                    lastFailed: { only: false },
                    selectivity: {
                        enabled: SelectivityMode.Enabled,
                        saveIncompleteDumpOnFail: false,
                        testDependenciesPath: "/test/chrome",
                    },
                })
                .withArgs("firefox")
                .returns({
                    lastFailed: { only: false },
                    selectivity: {
                        enabled: SelectivityMode.Enabled,
                        saveIncompleteDumpOnFail: false,
                        testDependenciesPath: "/test/firefox",
                    },
                });

            usedDumpsTrackerMock.usedDumpsFor.returns(true);
            fsStub.access.resolves();
            fsStub.readdir.resolves([]);

            await clearUnusedSelectivityDumps(configMock as any, false);

            assert.calledTwice(getSelectivityTestsPathStub);
            assert.calledWith(getSelectivityTestsPathStub.firstCall, "/test/chrome");
            assert.calledWith(getSelectivityTestsPathStub.secondCall, "/test/firefox");
            assert.calledTwice(fsStub.access);
            assert.calledTwice(fsStub.readdir);
        });

        it("should skip silently if directory does not exist (ENOENT)", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                lastFailed: { only: false },
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    saveIncompleteDumpOnFail: false,
                    testDependenciesPath: "/test/deps",
                },
            });

            usedDumpsTrackerMock.usedDumpsFor.returns(true);

            const enoentError = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
            enoentError.code = "ENOENT";
            fsStub.access.rejects(enoentError);

            await clearUnusedSelectivityDumps(configMock as any, false);

            assert.calledOnce(fsStub.access);
            assert.notCalled(fsStub.readdir);
            assert.notCalled(debugSelectivityStub);
        });

        it("should log debug message for non-ENOENT access errors", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                lastFailed: { only: false },
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    saveIncompleteDumpOnFail: false,
                    testDependenciesPath: "/test/deps",
                },
            });

            usedDumpsTrackerMock.usedDumpsFor.returns(true);

            const permissionError = new Error("EACCES: permission denied");
            fsStub.access.rejects(permissionError);

            await clearUnusedSelectivityDumps(configMock as any, false);

            assert.calledOnce(fsStub.access);
            assert.notCalled(fsStub.readdir);
            assert.calledOnceWith(
                debugSelectivityStub,
                sinon.match(/Couldn't access ".*" to clear stale files/),
                permissionError,
            );
        });

        it("should handle empty directory", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                lastFailed: { only: false },
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    saveIncompleteDumpOnFail: false,
                    testDependenciesPath: "/test/deps",
                },
            });

            usedDumpsTrackerMock.usedDumpsFor.returns(true);
            fsStub.access.resolves();
            fsStub.readdir.resolves([]);

            await clearUnusedSelectivityDumps(configMock as any, false);

            assert.calledOnce(fsStub.readdir);
            assert.notCalled(usedDumpsTrackerMock.wasUsed);
            assert.notCalled(fsStub.unlink);
            assert.notCalled(debugSelectivityStub);
        });

        it("should delete unused files", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                lastFailed: { only: false },
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    saveIncompleteDumpOnFail: false,
                    testDependenciesPath: "/test/deps",
                },
            });

            usedDumpsTrackerMock.usedDumpsFor.returns(true);
            usedDumpsTrackerMock.wasUsed.returns(false);
            fsStub.access.resolves();
            fsStub.readdir.resolves(["stale-test-1.json", "stale-test-2.json"]);
            fsStub.unlink.resolves();

            await clearUnusedSelectivityDumps(configMock as any, false);

            assert.calledTwice(usedDumpsTrackerMock.wasUsed);
            assert.calledWith(usedDumpsTrackerMock.wasUsed.firstCall, "stale-test-1", "/test/deps");
            assert.calledWith(usedDumpsTrackerMock.wasUsed.secondCall, "stale-test-2", "/test/deps");
            assert.calledTwice(fsStub.unlink);
            assert.calledWith(fsStub.unlink.firstCall, "/test/deps/tests/stale-test-1.json");
            assert.calledWith(fsStub.unlink.secondCall, "/test/deps/tests/stale-test-2.json");
            assert.calledOnceWith(
                debugSelectivityStub,
                sinon.match(/Out of 2 dump files, 2 were considered as outdated and deleted/),
            );
        });

        it("should not delete used files", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                lastFailed: { only: false },
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    saveIncompleteDumpOnFail: false,
                    testDependenciesPath: "/test/deps",
                },
            });

            usedDumpsTrackerMock.usedDumpsFor.returns(true);
            usedDumpsTrackerMock.wasUsed.returns(true);
            fsStub.access.resolves();
            fsStub.readdir.resolves(["used-test-1.json", "used-test-2.json"]);

            await clearUnusedSelectivityDumps(configMock as any, false);

            assert.calledTwice(usedDumpsTrackerMock.wasUsed);
            assert.notCalled(fsStub.unlink);
            assert.notCalled(debugSelectivityStub);
        });

        it("should handle mix of used and unused files", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                lastFailed: { only: false },
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    saveIncompleteDumpOnFail: false,
                    testDependenciesPath: "/test/deps",
                },
            });

            usedDumpsTrackerMock.usedDumpsFor.returns(true);
            usedDumpsTrackerMock.wasUsed
                .withArgs("stale-test", "/test/deps")
                .returns(false)
                .withArgs("fresh-test", "/test/deps")
                .returns(true)
                .withArgs("another-stale", "/test/deps")
                .returns(false);
            fsStub.access.resolves();
            fsStub.readdir.resolves(["stale-test.json", "fresh-test.json", "another-stale.json"]);
            fsStub.unlink.resolves();

            await clearUnusedSelectivityDumps(configMock as any, false);

            assert.calledThrice(usedDumpsTrackerMock.wasUsed);
            assert.calledTwice(fsStub.unlink);
            assert.calledWith(fsStub.unlink.firstCall, "/test/deps/tests/stale-test.json");
            assert.calledWith(fsStub.unlink.secondCall, "/test/deps/tests/another-stale.json");
            assert.calledOnceWith(
                debugSelectivityStub,
                sinon.match(/Out of 3 dump files, 2 were considered as outdated and deleted/),
            );
        });

        it("should handle unlink errors gracefully", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                lastFailed: { only: false },
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    saveIncompleteDumpOnFail: false,
                    testDependenciesPath: "/test/deps",
                },
            });

            usedDumpsTrackerMock.usedDumpsFor.returns(true);
            usedDumpsTrackerMock.wasUsed.returns(false);
            fsStub.access.resolves();
            fsStub.readdir.resolves(["stale-test-1.json", "stale-test-2.json"]);

            const unlinkError = new Error("unlink error");
            fsStub.unlink
                .withArgs("/test/deps/tests/stale-test-1.json")
                .rejects(unlinkError)
                .withArgs("/test/deps/tests/stale-test-2.json")
                .resolves();

            await clearUnusedSelectivityDumps(configMock as any, false);

            assert.calledTwice(fsStub.unlink);
            assert.calledTwice(debugSelectivityStub);
            assert.calledWith(
                debugSelectivityStub.firstCall,
                sinon.match(/Couldn't remove stale file ".*"/),
                unlinkError,
            );
            assert.calledWith(
                debugSelectivityStub.secondCall,
                sinon.match(/Out of 2 dump files, 1 were considered as outdated and deleted/),
            );
        });

        it("should skip files without .json extension", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                lastFailed: { only: false },
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    saveIncompleteDumpOnFail: false,
                    testDependenciesPath: "/test/deps",
                },
            });

            usedDumpsTrackerMock.usedDumpsFor.returns(true);
            usedDumpsTrackerMock.wasUsed.returns(false);
            fsStub.access.resolves();
            fsStub.readdir.resolves(["some-dir", "stale-file.json"]);
            fsStub.unlink.resolves();

            await clearUnusedSelectivityDumps(configMock as any, false);

            assert.calledOnceWith(usedDumpsTrackerMock.wasUsed, "stale-file", "/test/deps");
            assert.calledOnceWith(fsStub.unlink, "/test/deps/tests/stale-file.json");
            assert.calledOnceWith(
                debugSelectivityStub,
                sinon.match(/Out of 2 dump files, 1 were considered as outdated and deleted/),
            );
        });

        it("should not log if no files were deleted", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                lastFailed: { only: false },
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    saveIncompleteDumpOnFail: false,
                    testDependenciesPath: "/test/deps",
                },
            });

            usedDumpsTrackerMock.usedDumpsFor.returns(true);
            usedDumpsTrackerMock.wasUsed.returns(true);
            fsStub.access.resolves();
            fsStub.readdir.resolves(["used-test.json"]);

            await clearUnusedSelectivityDumps(configMock as any, false);

            assert.calledOnce(usedDumpsTrackerMock.wasUsed);
            assert.notCalled(fsStub.unlink);
            assert.notCalled(debugSelectivityStub);
        });

        it("should skip cleanup when run is failed and saveIncompleteDumpOnFail is false", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                lastFailed: { only: false },
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    saveIncompleteDumpOnFail: false,
                    testDependenciesPath: "/test/deps",
                },
            });

            await clearUnusedSelectivityDumps(configMock as any, true);

            assert.notCalled(usedDumpsTrackerMock.usedDumpsFor);
            assert.notCalled(getSelectivityTestsPathStub);
            assert.notCalled(fsStub.access);
        });

        it("should proceed with cleanup when run is failed and saveIncompleteDumpOnFail is true", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                lastFailed: { only: false },
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    saveIncompleteDumpOnFail: true,
                    testDependenciesPath: "/test/deps",
                },
            });

            usedDumpsTrackerMock.usedDumpsFor.returns(true);
            fsStub.access.resolves();
            fsStub.readdir.resolves([]);

            await clearUnusedSelectivityDumps(configMock as any, true);

            assert.calledOnce(usedDumpsTrackerMock.usedDumpsFor);
            assert.calledOnce(fsStub.access);
        });

        it("should skip cleanup when lastFailed.only is true", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                lastFailed: { only: true },
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    saveIncompleteDumpOnFail: true,
                    testDependenciesPath: "/test/deps",
                },
            });

            await clearUnusedSelectivityDumps(configMock as any, false);

            assert.notCalled(usedDumpsTrackerMock.usedDumpsFor);
            assert.notCalled(getSelectivityTestsPathStub);
            assert.notCalled(fsStub.access);
        });
    });
});
