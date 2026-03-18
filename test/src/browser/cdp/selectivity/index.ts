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
    let fsStub: {
        access: SinonStub;
        readdir: SinonStub;
        stat: SinonStub;
        unlink: SinonStub;
        constants: { R_OK: number; W_OK: number };
    };

    let cssSelectivityMock: { start: SinonStub; stop: SinonStub };
    let jsSelectivityMock: { start: SinonStub; stop: SinonStub };
    let testDependenciesWriterMock: { saveFor: SinonStub };
    let hashWriterMock: { addTestDependencyHashes: SinonStub; addPatternDependencyHash: SinonStub; save: SinonStub };
    let hashReaderMock: { patternHasChanged: SinonStub; getTestChangedDeps: SinonStub };
    let testDepsReaderMock: { getFor: SinonStub };

    let browserMock: {
        config: {
            selectivity: {
                enabled: SelectivityModeValue;
                sourceRoot: string;
                testDependenciesPath: string;
                compression: "none";
                disableSelectivityPatterns: string[];
                mapDependencyRelativePath: null;
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
            stop: sandbox.stub().resolves(new Set(["src/styles.css"])),
        };
        jsSelectivityMock = {
            start: sandbox.stub().resolves(),
            stop: sandbox.stub().resolves(new Set(["src/app.js"])),
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
            stat: sandbox.stub().resolves(null),
            unlink: sandbox.stub().resolves(),
            constants: { R_OK: 4, W_OK: 2 },
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
        getSelectivityTestsPathStub = sandbox.stub().callsFake((path: string) => `${path}/tests`);

        browserMock = {
            config: {
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    sourceRoot: "/test/source-root",
                    testDependenciesPath: "/test/dependencies",
                    compression: "none",
                    disableSelectivityPatterns: [],
                    mapDependencyRelativePath: null,
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
            "./utils": {
                transformSourceDependencies: transformSourceDependenciesStub,
                getSelectivityTestsPath: getSelectivityTestsPathStub,
            },
            "./debug": { debugSelectivity: debugSelectivityStub },
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
            assert.calledWith(transformSourceDependenciesStub, new Set(["src/styles.css"]), new Set(["src/app.js"]));
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
            jsSelectivityMock.stop.resolves([]);

            await stopFn(mockTest, false);

            assert.calledWith(transformSourceDependenciesStub, new Set(["src/styles.css"]), []);
            assert.calledOnce(testDependenciesWriterMock.saveFor);
        });

        it("should save dependencies when only JS dependencies exist", async () => {
            cssSelectivityMock.stop.resolves(null);

            await stopFn(mockTest, false);

            assert.calledWith(transformSourceDependenciesStub, null, new Set(["src/app.js"]));
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

        [SelectivityMode.Disabled, SelectivityMode.ReadOnly].forEach(mode => {
            it(`should skip browsers with selectivity mode ${mode}`, async () => {
                configMock.getBrowserIds.returns(["chrome", "firefox"]);
                configMock.forBrowser
                    .withArgs("chrome")
                    .returns({
                        selectivity: {
                            enabled: mode,
                            testDependenciesPath: "/test/path",
                            compression: "none",
                            disableSelectivityPatterns: ["src/**/*.js"],
                        },
                    })
                    .withArgs("firefox")
                    .returns({
                        selectivity: {
                            enabled: SelectivityMode.Enabled,
                            testDependenciesPath: "/test/path",
                            compression: "none",
                            disableSelectivityPatterns: ["src/**/*.js"],
                        },
                    });

                hashReaderMock.patternHasChanged.resolves(true);

                await updateSelectivityHashes(configMock as any);

                assert.calledOnceWith(getHashReaderStub, "/test/path", "none"); // Only for firefox
                assert.calledOnceWith(hashWriterMock.addPatternDependencyHash, "src/**/*.js");
                assert.calledOnce(hashWriterMock.save);
            });
        });

        it("should update hashes for changed patterns", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                selectivity: {
                    enabled: SelectivityMode.Enabled,
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
            assert.calledOnce(hashWriterMock.save);
        });

        it("should not add hashes for unchanged patterns", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    testDependenciesPath: "/test/path",
                    compression: "none",
                    disableSelectivityPatterns: ["pattern1", "pattern2"],
                },
            });

            hashReaderMock.patternHasChanged.resolves(false);

            await updateSelectivityHashes(configMock as any);

            assert.notCalled(hashWriterMock.addPatternDependencyHash);
            assert.calledOnce(hashWriterMock.save); // Still saves even if no patterns changed
        });

        it("should handle multiple browsers", async () => {
            configMock.getBrowserIds.returns(["chrome", "firefox"]);
            configMock.forBrowser
                .withArgs("chrome")
                .returns({
                    selectivity: {
                        enabled: SelectivityMode.Enabled,
                        testDependenciesPath: "/test/chrome",
                        compression: "none",
                        disableSelectivityPatterns: ["chrome-pattern"],
                    },
                })
                .withArgs("firefox")
                .returns({
                    selectivity: {
                        enabled: SelectivityMode.Enabled,
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
            assert.calledTwice(hashWriterMock.save);
        });

        it("should update hashes for WriteOnly mode", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                selectivity: {
                    enabled: SelectivityMode.WriteOnly,
                    testDependenciesPath: "/test/path",
                    compression: "none",
                    disableSelectivityPatterns: ["src/**/*.js"],
                },
            });

            hashReaderMock.patternHasChanged.resolves(true);

            await updateSelectivityHashes(configMock as any);

            assert.calledOnceWith(hashWriterMock.addPatternDependencyHash, "src/**/*.js");
            assert.calledOnce(hashWriterMock.save);
        });
    });

    describe("clearUnusedSelectivityDumps", () => {
        let configMock: {
            getBrowserIds: SinonStub;
            forBrowser: SinonStub;
        };
        const performanceTimeOrigin = performance.timeOrigin;

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
                        testDependenciesPath: "/test/chrome",
                    },
                })
                .withArgs("firefox")
                .returns({
                    selectivity: {
                        enabled: false,
                        testDependenciesPath: "/test/firefox",
                    },
                });

            await clearUnusedSelectivityDumps(configMock as any);

            assert.notCalled(getSelectivityTestsPathStub);
            assert.notCalled(fsStub.access);
            assert.notCalled(fsStub.readdir);
        });

        it("should process single browser with selectivity enabled", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                selectivity: {
                    enabled: true,
                    testDependenciesPath: "/test/deps",
                },
            });

            fsStub.access.resolves();
            fsStub.readdir.resolves([]);

            await clearUnusedSelectivityDumps(configMock as any);

            assert.calledOnceWith(getSelectivityTestsPathStub, "/test/deps");
            assert.calledOnceWith(fsStub.access, "/test/deps/tests", 6); // R_OK | W_OK = 4 | 2 = 6
            assert.calledOnceWith(fsStub.readdir, "/test/deps/tests");
        });

        it("should process multiple browsers with same selectivity root only once", async () => {
            configMock.getBrowserIds.returns(["chrome", "firefox"]);
            configMock.forBrowser
                .withArgs("chrome")
                .returns({
                    selectivity: {
                        enabled: true,
                        testDependenciesPath: "/test/shared",
                    },
                })
                .withArgs("firefox")
                .returns({
                    selectivity: {
                        enabled: true,
                        testDependenciesPath: "/test/shared",
                    },
                });

            fsStub.access.resolves();
            fsStub.readdir.resolves([]);

            await clearUnusedSelectivityDumps(configMock as any);

            assert.calledOnceWith(getSelectivityTestsPathStub, "/test/shared");
            assert.calledOnce(fsStub.access);
            assert.calledOnce(fsStub.readdir);
        });

        it("should process multiple browsers with different selectivity roots", async () => {
            configMock.getBrowserIds.returns(["chrome", "firefox"]);
            configMock.forBrowser
                .withArgs("chrome")
                .returns({
                    selectivity: {
                        enabled: true,
                        testDependenciesPath: "/test/chrome",
                    },
                })
                .withArgs("firefox")
                .returns({
                    selectivity: {
                        enabled: true,
                        testDependenciesPath: "/test/firefox",
                    },
                });

            fsStub.access.resolves();
            fsStub.readdir.resolves([]);

            await clearUnusedSelectivityDumps(configMock as any);

            assert.calledTwice(getSelectivityTestsPathStub);
            assert.calledWith(getSelectivityTestsPathStub.firstCall, "/test/chrome");
            assert.calledWith(getSelectivityTestsPathStub.secondCall, "/test/firefox");
            assert.calledTwice(fsStub.access);
            assert.calledTwice(fsStub.readdir);
        });

        it("should skip silently if directory does not exist (ENOENT)", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                selectivity: {
                    enabled: true,
                    testDependenciesPath: "/test/deps",
                },
            });

            const enoentError = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
            enoentError.code = "ENOENT";
            fsStub.access.rejects(enoentError);

            await clearUnusedSelectivityDumps(configMock as any);

            assert.calledOnce(fsStub.access);
            assert.notCalled(fsStub.readdir);
            assert.notCalled(debugSelectivityStub);
        });

        it("should log debug message for non-ENOENT access errors", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                selectivity: {
                    enabled: true,
                    testDependenciesPath: "/test/deps",
                },
            });

            const permissionError = new Error("EACCES: permission denied");
            fsStub.access.rejects(permissionError);

            await clearUnusedSelectivityDumps(configMock as any);

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
                selectivity: {
                    enabled: true,
                    testDependenciesPath: "/test/deps",
                },
            });

            fsStub.access.resolves();
            fsStub.readdir.resolves([]);

            await clearUnusedSelectivityDumps(configMock as any);

            assert.calledOnce(fsStub.readdir);
            assert.notCalled(fsStub.stat);
            assert.notCalled(fsStub.unlink);
            assert.notCalled(debugSelectivityStub);
        });

        it("should delete stale files", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                selectivity: {
                    enabled: true,
                    testDependenciesPath: "/test/deps",
                },
            });

            fsStub.access.resolves();
            fsStub.readdir.resolves(["stale-test-1.json", "stale-test-2.json"]);
            fsStub.stat.resolves({
                atimeMs: performanceTimeOrigin - 10000,
                isFile: () => true,
            });
            fsStub.unlink.resolves();

            await clearUnusedSelectivityDumps(configMock as any);

            assert.calledTwice(fsStub.stat);
            assert.calledWith(fsStub.stat.firstCall, "/test/deps/tests/stale-test-1.json");
            assert.calledWith(fsStub.stat.secondCall, "/test/deps/tests/stale-test-2.json");
            assert.calledTwice(fsStub.unlink);
            assert.calledWith(fsStub.unlink.firstCall, "/test/deps/tests/stale-test-1.json");
            assert.calledWith(fsStub.unlink.secondCall, "/test/deps/tests/stale-test-2.json");
            assert.calledOnceWith(
                debugSelectivityStub,
                sinon.match(/Out of 2 files, 2 were considered as outdated and deleted/),
            );
        });

        it("should not delete fresh files", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                selectivity: {
                    enabled: true,
                    testDependenciesPath: "/test/deps",
                },
            });

            fsStub.access.resolves();
            fsStub.readdir.resolves(["fresh-test-1.json", "fresh-test-2.json"]);
            fsStub.stat.resolves({
                atimeMs: performanceTimeOrigin + 5000,
                isFile: () => true,
            });

            await clearUnusedSelectivityDumps(configMock as any);

            assert.calledTwice(fsStub.stat);
            assert.notCalled(fsStub.unlink);
            assert.notCalled(debugSelectivityStub);
        });

        it("should handle mix of stale and fresh files", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                selectivity: {
                    enabled: true,
                    testDependenciesPath: "/test/deps",
                },
            });

            fsStub.access.resolves();
            fsStub.readdir.resolves(["stale-test.json", "fresh-test.json", "another-stale.json"]);
            fsStub.stat
                .withArgs("/test/deps/tests/stale-test.json")
                .resolves({
                    atimeMs: performanceTimeOrigin - 10000,
                    isFile: () => true,
                })
                .withArgs("/test/deps/tests/fresh-test.json")
                .resolves({
                    atimeMs: performanceTimeOrigin + 5000,
                    isFile: () => true,
                })
                .withArgs("/test/deps/tests/another-stale.json")
                .resolves({
                    atimeMs: performanceTimeOrigin - 20000,
                    isFile: () => true,
                });
            fsStub.unlink.resolves();

            await clearUnusedSelectivityDumps(configMock as any);

            assert.calledThrice(fsStub.stat);
            assert.calledTwice(fsStub.unlink);
            assert.calledWith(fsStub.unlink.firstCall, "/test/deps/tests/stale-test.json");
            assert.calledWith(fsStub.unlink.secondCall, "/test/deps/tests/another-stale.json");
            assert.calledOnceWith(
                debugSelectivityStub,
                sinon.match(/Out of 3 files, 2 were considered as outdated and deleted/),
            );
        });

        it("should skip files when stat fails", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                selectivity: {
                    enabled: true,
                    testDependenciesPath: "/test/deps",
                },
            });

            fsStub.access.resolves();
            fsStub.readdir.resolves(["test-1.json", "test-2.json"]);
            fsStub.stat
                .withArgs("/test/deps/tests/test-1.json")
                .rejects(new Error("stat error"))
                .withArgs("/test/deps/tests/test-2.json")
                .resolves({
                    atimeMs: performanceTimeOrigin - 10000,
                    isFile: () => true,
                });
            fsStub.unlink.resolves();

            await clearUnusedSelectivityDumps(configMock as any);

            assert.calledTwice(fsStub.stat);
            assert.calledOnceWith(fsStub.unlink, "/test/deps/tests/test-2.json");
            assert.calledTwice(debugSelectivityStub);
            assert.calledWith(
                debugSelectivityStub.firstCall,
                sinon.match(/Couldn't access file ".*" to check if it was used/),
            );
            assert.calledWith(
                debugSelectivityStub.secondCall,
                sinon.match(/Out of 2 files, 1 were considered as outdated and deleted/),
            );
        });

        it("should handle unlink errors gracefully", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                selectivity: {
                    enabled: true,
                    testDependenciesPath: "/test/deps",
                },
            });

            fsStub.access.resolves();
            fsStub.readdir.resolves(["stale-test-1.json", "stale-test-2.json"]);
            fsStub.stat.resolves({
                atimeMs: performanceTimeOrigin - 10000,
                isFile: () => true,
            });

            const unlinkError = new Error("unlink error");
            fsStub.unlink
                .withArgs("/test/deps/tests/stale-test-1.json")
                .rejects(unlinkError)
                .withArgs("/test/deps/tests/stale-test-2.json")
                .resolves();

            await clearUnusedSelectivityDumps(configMock as any);

            assert.calledTwice(fsStub.unlink);
            assert.calledTwice(debugSelectivityStub);
            assert.calledWith(
                debugSelectivityStub.firstCall,
                sinon.match(/Couldn't remove stale file ".*"/),
                unlinkError,
            );
            assert.calledWith(
                debugSelectivityStub.secondCall,
                sinon.match(/Out of 2 files, 1 were considered as outdated and deleted/),
            );
        });

        it("should not delete directories even if stale", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                selectivity: {
                    enabled: true,
                    testDependenciesPath: "/test/deps",
                },
            });

            fsStub.access.resolves();
            fsStub.readdir.resolves(["stale-dir", "stale-file.json"]);
            fsStub.stat
                .withArgs("/test/deps/tests/stale-dir")
                .resolves({
                    atimeMs: performanceTimeOrigin - 10000,
                    isFile: () => false,
                })
                .withArgs("/test/deps/tests/stale-file.json")
                .resolves({
                    atimeMs: performanceTimeOrigin - 10000,
                    isFile: () => true,
                });
            fsStub.unlink.resolves();

            await clearUnusedSelectivityDumps(configMock as any);

            assert.calledTwice(fsStub.stat);
            assert.calledOnceWith(fsStub.unlink, "/test/deps/tests/stale-file.json");
            assert.calledOnceWith(
                debugSelectivityStub,
                sinon.match(/Out of 2 files, 1 were considered as outdated and deleted/),
            );
        });

        it("should not log if no files were deleted", async () => {
            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.withArgs("chrome").returns({
                selectivity: {
                    enabled: true,
                    testDependenciesPath: "/test/deps",
                },
            });

            fsStub.access.resolves();
            fsStub.readdir.resolves(["fresh-test.json"]);
            fsStub.stat.resolves({
                atimeMs: performanceTimeOrigin + 5000,
                isFile: () => true,
            });

            await clearUnusedSelectivityDumps(configMock as any);

            assert.calledOnce(fsStub.stat);
            assert.notCalled(fsStub.unlink);
            assert.notCalled(debugSelectivityStub);
        });
    });
});
