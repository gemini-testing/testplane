import sinon, { SinonStub } from "sinon";
import proxyquire from "proxyquire";
import type { ExistingBrowser } from "src/browser/existing-browser";
import type { Test } from "src/types";

describe("CDP/Selectivity", () => {
    const sandbox = sinon.createSandbox();
    let startSelectivity: typeof import("src/browser/cdp/selectivity/index").startSelectivity;
    let updateSelectivityHashes: typeof import("src/browser/cdp/selectivity/index").updateSelectivityHashes;

    let CSSSelectivityStub: SinonStub;
    let JSSelectivityStub: SinonStub;
    let getTestDependenciesWriterStub: SinonStub;
    let getHashWriterStub: SinonStub;
    let getHashReaderStub: SinonStub;
    let getTestDependenciesReaderStub: SinonStub;
    let transformSourceDependenciesStub: SinonStub;
    let debugSelectivityStub: SinonStub;

    let cssSelectivityMock: { start: SinonStub; stop: SinonStub };
    let jsSelectivityMock: { start: SinonStub; stop: SinonStub };
    let testDependenciesWriterMock: { saveFor: SinonStub };
    let hashWriterMock: { addTestDependencyHashes: SinonStub; addPatternDependencyHash: SinonStub; commit: SinonStub };
    let hashReaderMock: { patternHasChanged: SinonStub; getTestChangedDeps: SinonStub };
    let testDepsReaderMock: { getFor: SinonStub };

    let browserMock: {
        config: {
            selectivity: {
                enabled: boolean;
                sourceRoot: string;
                testDependenciesPath: string;
                compression: "none";
                disableSelectivityPatterns: string[];
            };
        };
        publicAPI: { isChromium: boolean; getWindowHandle: SinonStub };
        cdp: {
            target: { getTargets: SinonStub; attachToTarget: SinonStub; detachFromTarget: SinonStub };
        } | null;
    };

    beforeEach(() => {
        cssSelectivityMock = {
            start: sandbox.stub().resolves(),
            stop: sandbox.stub().resolves(["src/styles.css"]),
        };
        jsSelectivityMock = {
            start: sandbox.stub().resolves(),
            stop: sandbox.stub().resolves(["src/app.js"]),
        };
        testDependenciesWriterMock = {
            saveFor: sandbox.stub().resolves(),
        };
        hashWriterMock = {
            addTestDependencyHashes: sandbox.stub(),
            addPatternDependencyHash: sandbox.stub(),
            commit: sandbox.stub().resolves(),
        };
        hashReaderMock = {
            patternHasChanged: sandbox.stub(),
            getTestChangedDeps: sandbox.stub(),
        };
        testDepsReaderMock = {
            getFor: sandbox.stub(),
        };

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

        browserMock = {
            config: {
                selectivity: {
                    enabled: true,
                    sourceRoot: "/test/source-root",
                    testDependenciesPath: "/test/dependencies",
                    compression: "none",
                    disableSelectivityPatterns: [],
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
                },
            },
        };

        const proxyquiredModule = proxyquire("src/browser/cdp/selectivity/index", {
            "./css-selectivity": { CSSSelectivity: CSSSelectivityStub },
            "./js-selectivity": { JSSelectivity: JSSelectivityStub },
            "./test-dependencies-writer": { getTestDependenciesWriter: getTestDependenciesWriterStub },
            "./hash-writer": { getHashWriter: getHashWriterStub },
            "./hash-reader": { getHashReader: getHashReaderStub },
            "./test-dependencies-reader": { getTestDependenciesReader: getTestDependenciesReaderStub },
            "./utils": { transformSourceDependencies: transformSourceDependenciesStub },
            "./debug": { debugSelectivity: debugSelectivityStub },
        });

        startSelectivity = proxyquiredModule.startSelectivity;
        updateSelectivityHashes = proxyquiredModule.updateSelectivityHashes;
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("startSelectivity", () => {
        it("should return no-op function if selectivity is disabled", async () => {
            browserMock.config.selectivity.enabled = false;

            const stopFn = await startSelectivity(browserMock as unknown as ExistingBrowser);

            assert.isFunction(stopFn);

            await stopFn({ id: "test", browserId: "chrome" } as Test, true);

            assert.notCalled(CSSSelectivityStub);
            assert.notCalled(JSSelectivityStub);
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
            assert.notCalled(hashWriterMock.commit);
        });

        it("should stop selectivity and save dependencies when drop is false", async () => {
            await stopFn(mockTest, false);

            assert.calledWith(cssSelectivityMock.stop, false);
            assert.calledWith(jsSelectivityMock.stop, false);
            assert.calledWith(transformSourceDependenciesStub, ["src/styles.css"], ["src/app.js"]);
            assert.calledWith(getTestDependenciesWriterStub, "/test/dependencies");
            assert.calledWith(testDependenciesWriterMock.saveFor, mockTest, {
                css: ["src/styles.css"],
                js: ["src/app.js"],
                modules: ["node_modules/react"],
            });
        });

        it("should not save when no dependencies are found", async () => {
            cssSelectivityMock.stop.resolves([]);
            jsSelectivityMock.stop.resolves([]);

            await stopFn(mockTest, false);

            assert.notCalled(testDependenciesWriterMock.saveFor);
            assert.notCalled(hashWriterMock.addTestDependencyHashes);
            assert.notCalled(hashWriterMock.commit);
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
            jsSelectivityMock.stop.resolves([]);

            await stopFn(mockTest, false);

            assert.calledWith(transformSourceDependenciesStub, ["src/styles.css"], []);
            assert.calledOnce(testDependenciesWriterMock.saveFor);
        });

        it("should save dependencies when only JS dependencies exist", async () => {
            cssSelectivityMock.stop.resolves([]);

            await stopFn(mockTest, false);

            assert.calledWith(transformSourceDependenciesStub, [], ["src/app.js"]);
            assert.calledOnce(testDependenciesWriterMock.saveFor);
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

        it("should skip browsers with selectivity disabled", async () => {
            configMock.getBrowserIds.returns(["chrome", "firefox"]);
            configMock.forBrowser
                .withArgs("chrome")
                .returns({
                    selectivity: {
                        enabled: false,
                        testDependenciesPath: "/test/path",
                        compression: "none",
                        disableSelectivityPatterns: ["src/**/*.js"],
                    },
                })
                .withArgs("firefox")
                .returns({
                    selectivity: {
                        enabled: true,
                        testDependenciesPath: "/test/path",
                        compression: "none",
                        disableSelectivityPatterns: ["src/**/*.js"],
                    },
                });

            hashReaderMock.patternHasChanged.resolves(true);

            await updateSelectivityHashes(configMock as any);

            assert.calledOnce(getHashReaderStub); // Only for firefox
            assert.calledWith(getHashReaderStub, "/test/path", "none");
            assert.calledOnce(hashWriterMock.addPatternDependencyHash);
            assert.calledWith(hashWriterMock.addPatternDependencyHash, "src/**/*.js");
            assert.calledOnce(hashWriterMock.commit);
        });

        it("should update hashes for changed patterns", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                selectivity: {
                    enabled: true,
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

            await updateSelectivityHashes(configMock as any);

            assert.calledWith(getHashReaderStub, "/test/path", "gz");
            assert.calledWith(getHashWriterStub, "/test/path", "gz");
            assert.calledTwice(hashWriterMock.addPatternDependencyHash);
            assert.calledWith(hashWriterMock.addPatternDependencyHash.firstCall, "pattern1");
            assert.calledWith(hashWriterMock.addPatternDependencyHash.secondCall, "pattern3");
            assert.calledOnce(hashWriterMock.commit);
        });

        it("should not add hashes for unchanged patterns", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                selectivity: {
                    enabled: true,
                    testDependenciesPath: "/test/path",
                    compression: "none",
                    disableSelectivityPatterns: ["pattern1", "pattern2"],
                },
            });

            hashReaderMock.patternHasChanged.resolves(false);

            await updateSelectivityHashes(configMock as any);

            assert.notCalled(hashWriterMock.addPatternDependencyHash);
            assert.calledOnce(hashWriterMock.commit); // Still commits even if no patterns changed
        });

        it("should handle multiple browsers", async () => {
            configMock.getBrowserIds.returns(["chrome", "firefox"]);
            configMock.forBrowser
                .withArgs("chrome")
                .returns({
                    selectivity: {
                        enabled: true,
                        testDependenciesPath: "/test/chrome",
                        compression: "none",
                        disableSelectivityPatterns: ["chrome-pattern"],
                    },
                })
                .withArgs("firefox")
                .returns({
                    selectivity: {
                        enabled: true,
                        testDependenciesPath: "/test/firefox",
                        compression: "gz",
                        disableSelectivityPatterns: ["firefox-pattern"],
                    },
                });

            hashReaderMock.patternHasChanged.resolves(true);

            await updateSelectivityHashes(configMock as any);

            assert.calledTwice(getHashReaderStub);
            assert.calledWith(getHashReaderStub.firstCall, "/test/chrome", "none");
            assert.calledWith(getHashReaderStub.secondCall, "/test/firefox", "gz");
            assert.calledTwice(hashWriterMock.addPatternDependencyHash);
            assert.calledTwice(hashWriterMock.commit);
        });
    });
});
