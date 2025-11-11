import sinon, { SinonStub } from "sinon";
import proxyquire from "proxyquire";
import type { ExistingBrowser } from "src/browser/existing-browser";
import type { Test } from "src/types";

describe("CDP/Selectivity", () => {
    const sandbox = sinon.createSandbox();
    let startSelectivity: typeof import("src/browser/cdp/selectivity/index").startSelectivity;
    let shouldDisableSelectivity: typeof import("src/browser/cdp/selectivity/index").shouldDisableSelectivity;
    let updateDisableSelectivityPatternsHashes: typeof import("src/browser/cdp/selectivity/index").updateDisableSelectivityPatternsHashes;
    let shouldDisableTestBySelectivity: typeof import("src/browser/cdp/selectivity/index").shouldDisableTestBySelectivity;

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
        shouldDisableSelectivity = proxyquiredModule.shouldDisableSelectivity;
        updateDisableSelectivityPatternsHashes = proxyquiredModule.updateDisableSelectivityPatternsHashes;
        shouldDisableTestBySelectivity = proxyquiredModule.shouldDisableTestBySelectivity;
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
            assert.calledWith(getHashWriterStub, "/test/dependencies");
            assert.calledWith(hashWriterMock.addTestDependencyHashes, {
                css: ["src/styles.css"],
                js: ["src/app.js"],
                modules: ["node_modules/react"],
            });
            assert.calledWith(testDependenciesWriterMock.saveFor, mockTest, {
                css: ["src/styles.css"],
                js: ["src/app.js"],
                modules: ["node_modules/react"],
            });
            assert.calledOnce(hashWriterMock.commit);
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

        it("should handle file hash writer errors", async () => {
            hashWriterMock.commit.rejects(new Error("Commit error"));

            await assert.isRejected(stopFn(mockTest, false), "Commit error");
        });

        it("should save dependencies when only CSS dependencies exist", async () => {
            jsSelectivityMock.stop.resolves([]);

            await stopFn(mockTest, false);

            assert.calledWith(transformSourceDependenciesStub, ["src/styles.css"], []);
            assert.calledOnce(testDependenciesWriterMock.saveFor);
            assert.calledOnce(hashWriterMock.addTestDependencyHashes);
            assert.calledOnce(hashWriterMock.commit);
        });

        it("should save dependencies when only JS dependencies exist", async () => {
            cssSelectivityMock.stop.resolves([]);

            await stopFn(mockTest, false);

            assert.calledWith(transformSourceDependenciesStub, [], ["src/app.js"]);
            assert.calledOnce(testDependenciesWriterMock.saveFor);
            assert.calledOnce(hashWriterMock.addTestDependencyHashes);
            assert.calledOnce(hashWriterMock.commit);
        });
    });

    describe("shouldDisableSelectivity", () => {
        it("should return true if selectivity is disabled", async () => {
            const config = {
                selectivity: {
                    enabled: false,
                    testDependenciesPath: "/test/path",
                    compression: "none" as const,
                    disableSelectivityPatterns: ["src/**/*.js"],
                },
            };

            const result = await shouldDisableSelectivity(config as any, "chrome");

            assert.isTrue(result);
            assert.notCalled(getHashReaderStub);
        });

        it("should return false if no disable patterns are configured", async () => {
            const config = {
                selectivity: {
                    enabled: true,
                    testDependenciesPath: "/test/path",
                    compression: "none" as const,
                    disableSelectivityPatterns: [],
                },
            };

            const result = await shouldDisableSelectivity(config as any, "chrome");

            assert.isFalse(result);
            assert.notCalled(getHashReaderStub);
        });

        it("should return true if any pattern has changed", async () => {
            const config = {
                selectivity: {
                    enabled: true,
                    testDependenciesPath: "/test/path",
                    compression: "none" as const,
                    disableSelectivityPatterns: ["src/**/*.js", "test/**/*.js"],
                },
            };

            hashReaderMock.patternHasChanged
                .withArgs("src/**/*.js")
                .resolves(false)
                .withArgs("test/**/*.js")
                .resolves(true);

            const result = await shouldDisableSelectivity(config as any, "chrome");

            assert.isTrue(result);
            assert.calledWith(getHashReaderStub, "/test/path", "none");
            assert.calledWith(
                debugSelectivityStub,
                'Disabling selectivity for chrome: file change by pattern "test/**/*.js" is detected',
            );
        });

        it("should return false if no patterns have changed", async () => {
            const config = {
                selectivity: {
                    enabled: true,
                    testDependenciesPath: "/test/path",
                    compression: "gz" as const,
                    disableSelectivityPatterns: ["src/**/*.js", "test/**/*.js"],
                },
            };

            hashReaderMock.patternHasChanged.resolves(false);

            const result = await shouldDisableSelectivity(config as any, "firefox");

            assert.isFalse(result);
            assert.calledWith(getHashReaderStub, "/test/path", "gz");
            assert.calledWith(debugSelectivityStub, "None of 'disableSelectivityPatterns' is changed for firefox");
        });

        it("should return true if pattern check throws an error", async () => {
            const config = {
                selectivity: {
                    enabled: true,
                    testDependenciesPath: "/test/path",
                    compression: "br" as const,
                    disableSelectivityPatterns: ["src/**/*.js"],
                },
            };

            const error = new Error("Pattern check failed");
            hashReaderMock.patternHasChanged.rejects(error);

            const result = await shouldDisableSelectivity(config as any, "safari");

            assert.isTrue(result);
            assert.calledWith(
                debugSelectivityStub,
                "Disabling selectivity for safari: got an error while checking 'disableSelectivityPatterns': %O",
                error,
            );
        });

        it("should be memoized based on config parameters", async () => {
            const config1 = {
                selectivity: {
                    enabled: true,
                    testDependenciesPath: "/test/path1",
                    compression: "none" as const,
                    disableSelectivityPatterns: ["src/**/*.js"],
                },
            };
            const config2 = {
                selectivity: {
                    enabled: true,
                    testDependenciesPath: "/test/path2",
                    compression: "none" as const,
                    disableSelectivityPatterns: ["src/**/*.js"],
                },
            };

            hashReaderMock.patternHasChanged.resolves(false);

            await shouldDisableSelectivity(config1 as any, "chrome");
            await shouldDisableSelectivity(config1 as any, "chrome"); // Same config, should be memoized
            await shouldDisableSelectivity(config2 as any, "chrome"); // Different config, should not be memoized

            assert.calledTwice(getHashReaderStub); // Once for config1, once for config2
        });
    });

    describe("updateDisableSelectivityPatternsHashes", () => {
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

            await updateDisableSelectivityPatternsHashes(configMock as any);

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

            await updateDisableSelectivityPatternsHashes(configMock as any);

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

            await updateDisableSelectivityPatternsHashes(configMock as any);

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

            await updateDisableSelectivityPatternsHashes(configMock as any);

            assert.calledTwice(getHashReaderStub);
            assert.calledWith(getHashReaderStub.firstCall, "/test/chrome", "none");
            assert.calledWith(getHashReaderStub.secondCall, "/test/firefox", "gz");
            assert.calledTwice(hashWriterMock.addPatternDependencyHash);
            assert.calledTwice(hashWriterMock.commit);
        });
    });

    describe("shouldDisableTestBySelectivity", () => {
        it("should return false if selectivity is disabled", async () => {
            const config = {
                selectivity: {
                    enabled: false,
                    testDependenciesPath: "/test/path",
                    compression: "none" as const,
                },
            };
            const test = { id: "test-123", fullTitle: () => "Test Suite Test Case" } as any;

            const result = await shouldDisableTestBySelectivity(config as any, test);

            assert.isFalse(result);
            assert.notCalled(getTestDependenciesReaderStub);
            assert.notCalled(getHashReaderStub);
        });

        it("should return false if test has no JS dependencies", async () => {
            const config = {
                selectivity: {
                    enabled: true,
                    testDependenciesPath: "/test/path",
                    compression: "none" as const,
                },
            };
            const test = { id: "test-123", fullTitle: () => "Test Suite Test Case" } as any;
            const testDeps = { css: ["src/styles.css"], js: [], modules: ["react"] };

            testDepsReaderMock.getFor.resolves(testDeps);

            const result = await shouldDisableTestBySelectivity(config as any, test);

            assert.isFalse(result);
            assert.calledWith(getTestDependenciesReaderStub, "/test/path", "none");
            assert.calledWith(getHashReaderStub, "/test/path", "none");
            assert.calledWith(testDepsReaderMock.getFor, test);
            assert.notCalled(hashReaderMock.getTestChangedDeps);
            assert.calledWith(
                debugSelectivityStub,
                'Not disabling "Test Suite Test Case" as it has no js deps and therefore it was considered as new',
            );
        });

        it("should return false if test dependencies have changed", async () => {
            const config = {
                selectivity: {
                    enabled: true,
                    testDependenciesPath: "/test/path",
                    compression: "gz" as const,
                },
            };
            const test = { id: "test-123", fullTitle: () => "Test Suite Test Case" } as any;
            const testDeps = { css: ["src/styles.css"], js: ["src/app.js"], modules: ["react"] };
            const changedDeps = { css: [], js: ["src/app.js"], modules: [] };

            testDepsReaderMock.getFor.resolves(testDeps);
            hashReaderMock.getTestChangedDeps.resolves(changedDeps);

            const result = await shouldDisableTestBySelectivity(config as any, test);

            assert.isFalse(result);
            assert.calledWith(getTestDependenciesReaderStub, "/test/path", "gz");
            assert.calledWith(getHashReaderStub, "/test/path", "gz");
            assert.calledWith(testDepsReaderMock.getFor, test);
            assert.calledWith(hashReaderMock.getTestChangedDeps, testDeps);
            assert.calledWith(
                debugSelectivityStub,
                'Not disabling "Test Suite Test Case" as its dependencies were changed: %O',
                changedDeps,
            );
        });

        it("should return true if test dependencies have not changed", async () => {
            const config = {
                selectivity: {
                    enabled: true,
                    testDependenciesPath: "/test/path",
                    compression: "br" as const,
                },
            };
            const test = { id: "test-123", fullTitle: () => "Test Suite Test Case" } as any;
            const testDeps = { css: ["src/styles.css"], js: ["src/app.js"], modules: ["react"] };

            testDepsReaderMock.getFor.resolves(testDeps);
            hashReaderMock.getTestChangedDeps.resolves(null); // No changes

            const result = await shouldDisableTestBySelectivity(config as any, test);

            assert.isTrue(result);
            assert.calledWith(getTestDependenciesReaderStub, "/test/path", "br");
            assert.calledWith(getHashReaderStub, "/test/path", "br");
            assert.calledWith(testDepsReaderMock.getFor, test);
            assert.calledWith(hashReaderMock.getTestChangedDeps, testDeps);
            assert.calledWith(
                debugSelectivityStub,
                'Disabling "Test Suite Test Case" as its dependencies were not changed',
            );
        });

        it("should be memoized based on config and test parameters", async () => {
            const config = {
                selectivity: {
                    enabled: true,
                    testDependenciesPath: "/test/path",
                    compression: "none" as const,
                },
            };
            const test1 = { id: "test-123", fullTitle: () => "Test 1" } as any;
            const test2 = { id: "test-456", fullTitle: () => "Test 2" } as any;
            const testDeps = { css: [], js: ["src/app.js"], modules: [] };

            testDepsReaderMock.getFor.resolves(testDeps);
            hashReaderMock.getTestChangedDeps.resolves(null);

            await shouldDisableTestBySelectivity(config as any, test1);
            await shouldDisableTestBySelectivity(config as any, test1); // Same test, should be memoized
            await shouldDisableTestBySelectivity(config as any, test2); // Different test, should not be memoized

            assert.calledTwice(testDepsReaderMock.getFor); // Once for test1, once for test2
        });
    });
});
