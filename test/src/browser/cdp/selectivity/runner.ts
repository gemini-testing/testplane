import sinon, { SinonStub } from "sinon";
import proxyquire from "proxyquire";
import type { SelectivityRunner } from "src/browser/cdp/selectivity/runner";
import type { Test } from "src/types";
import { MasterEvents } from "src/events";
import { SelectivityMode, type SelectivityModeValue } from "src/config/types";

describe("SelectivityRunner", () => {
    const sandbox = sinon.createSandbox();
    let SelectivityRunnerClass: typeof SelectivityRunner;
    let debugSelectivityStub: SinonStub;
    let getHashReaderStub: SinonStub;
    let getHashWriterStub: SinonStub;
    let getTestDependenciesReaderStub: SinonStub;
    let getUsedDumpsTrackerStub: SinonStub;
    let getTestSelectivityDumpIdStub: SinonStub;
    let usedDumpsTrackerMock: { trackUsed: SinonStub; usedDumpsFor: SinonStub; wasUsed: SinonStub };
    let fsExtraStub: { outputJson: SinonStub };
    let loggerStub: { error: SinonStub };

    let mainRunnerMock: { on: SinonStub };
    let configMock: { forBrowser: SinonStub; getBrowserIds: SinonStub };
    let runTestFnMock: SinonStub;
    let hashReaderMock: { patternHasChanged: SinonStub; getTestChangedDeps: SinonStub; clearCache: SinonStub };
    let hashWriterMock: { addTestDependencyHashes: SinonStub };
    let testDepsReaderMock: { getFor: SinonStub };

    beforeEach(() => {
        debugSelectivityStub = sandbox.stub();
        getHashReaderStub = sandbox.stub();
        getHashWriterStub = sandbox.stub();
        getTestDependenciesReaderStub = sandbox.stub();
        fsExtraStub = { outputJson: sandbox.stub().resolves() };
        loggerStub = { error: sandbox.stub() };

        usedDumpsTrackerMock = {
            trackUsed: sandbox.stub(),
            usedDumpsFor: sandbox.stub().returns(false),
            wasUsed: sandbox.stub().returns(false),
        };
        getUsedDumpsTrackerStub = sandbox.stub().returns(usedDumpsTrackerMock);
        getTestSelectivityDumpIdStub = sandbox.stub().callsFake((test: Test) => test.id);

        hashReaderMock = {
            patternHasChanged: sandbox.stub(),
            getTestChangedDeps: sandbox.stub(),
            clearCache: sandbox.stub(),
        };
        hashWriterMock = {
            addTestDependencyHashes: sandbox.stub(),
        };
        testDepsReaderMock = {
            getFor: sandbox.stub(),
        };

        mainRunnerMock = {
            on: sandbox.stub(),
        };
        configMock = {
            forBrowser: sandbox.stub(),
            getBrowserIds: sandbox.stub().returns([]),
        };
        runTestFnMock = sandbox.stub();

        getHashReaderStub.returns(hashReaderMock);
        getHashWriterStub.returns(hashWriterMock);
        getTestDependenciesReaderStub.returns(testDepsReaderMock);

        const proxyquiredModule = proxyquire("src/browser/cdp/selectivity/runner", {
            "./debug": { debugSelectivity: debugSelectivityStub },
            "./hash-reader": { getHashReader: getHashReaderStub },
            "./hash-writer": { getHashWriter: getHashWriterStub },
            "./test-dependencies-reader": { getTestDependenciesReader: getTestDependenciesReaderStub },
            "./used-dumps-tracker": { getUsedDumpsTracker: getUsedDumpsTrackerStub },
            "./utils": { getTestSelectivityDumpId: getTestSelectivityDumpIdStub },
            "fs-extra": fsExtraStub,
            "../../../utils/logger": loggerStub,
        });

        SelectivityRunnerClass = proxyquiredModule.SelectivityRunner;
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("constructor and event setup", () => {
        it("should set up event listener for TEST_DEPENDENCIES when shouldDisableSelectivity is not set", () => {
            new SelectivityRunnerClass(mainRunnerMock as any, configMock as any, runTestFnMock);

            assert.calledOnce(mainRunnerMock.on);
            assert.calledWith(mainRunnerMock.on, MasterEvents.TEST_DEPENDENCIES, sinon.match.func);
            assert.notCalled(debugSelectivityStub);
        });

        it("should not set up event listener when shouldDisableSelectivity is set", () => {
            new SelectivityRunnerClass(mainRunnerMock as any, configMock as any, runTestFnMock, {
                shouldDisableSelectivity: true,
            });

            assert.notCalled(mainRunnerMock.on);
            assert.calledWith(debugSelectivityStub, "Test filter is specified, disabling selectivity");
        });
    });

    describe("runIfNecessary", () => {
        let runner: SelectivityRunner;
        let browserConfigMock: {
            selectivity: {
                enabled: SelectivityModeValue;
                testDependenciesPath: string;
                compression: string;
                disableSelectivityPatterns: string[];
            };
        };
        let testMock: Test;

        beforeEach(() => {
            browserConfigMock = {
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    testDependenciesPath: "/test/path",
                    compression: "none",
                    disableSelectivityPatterns: [],
                },
            };
            testMock = {
                id: "test-123",
                browserId: "chrome",
                fullTitle: () => "Test Suite Test Case",
            } as Test;

            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.returns(browserConfigMock);
            runner = new SelectivityRunnerClass(mainRunnerMock as any, configMock as any, runTestFnMock);
        });

        it("should run test if selectivity mode is Disabled and not track dumps", async () => {
            browserConfigMock.selectivity.enabled = SelectivityMode.Disabled;

            runner.startTestCheckToRun(testMock, "chrome");
            await runner.runNecessaryTests();

            assert.calledOnce(runTestFnMock);
            assert.calledWith(runTestFnMock, testMock, "chrome");
            assert.notCalled(usedDumpsTrackerMock.trackUsed);
        });

        it("should run test if selectivity mode is WriteOnly and track dumps", async () => {
            browserConfigMock.selectivity.enabled = SelectivityMode.WriteOnly;

            runner.startTestCheckToRun(testMock, "chrome");
            await runner.runNecessaryTests();

            assert.calledOnce(runTestFnMock);
            assert.calledWith(runTestFnMock, testMock, "chrome");
            assert.calledOnceWith(usedDumpsTrackerMock.trackUsed, "test-123", "/test/path");
        });

        it("should run test if shouldDisableSelectivity option is true and not track dumps", async () => {
            const runnerWithDisabledSelectivity = new SelectivityRunnerClass(
                mainRunnerMock as any,
                configMock as any,
                runTestFnMock,
                { shouldDisableSelectivity: true },
            );

            runnerWithDisabledSelectivity.startTestCheckToRun(testMock, "chrome");
            await runnerWithDisabledSelectivity.runNecessaryTests();

            assert.calledOnce(runTestFnMock);
            assert.calledWith(runTestFnMock, testMock, "chrome");
            assert.notCalled(usedDumpsTrackerMock.trackUsed);
        });

        it("should run test if both browser selectivity is disabled and shouldDisableSelectivity is true", async () => {
            browserConfigMock.selectivity.enabled = SelectivityMode.Disabled;
            const runnerWithDisabledSelectivity = new SelectivityRunnerClass(
                mainRunnerMock as any,
                configMock as any,
                runTestFnMock,
                { shouldDisableSelectivity: true },
            );

            runnerWithDisabledSelectivity.startTestCheckToRun(testMock, "chrome");
            await runnerWithDisabledSelectivity.runNecessaryTests();

            assert.calledOnce(runTestFnMock);
            assert.calledWith(runTestFnMock, testMock, "chrome");
            assert.notCalled(usedDumpsTrackerMock.trackUsed);
        });

        it("should run test if test is already disabled and not track dumps when selectivity is enabled", async () => {
            browserConfigMock.selectivity.enabled = SelectivityMode.Enabled;
            browserConfigMock.selectivity.disableSelectivityPatterns = ["src/**/*.js"];
            hashReaderMock.patternHasChanged.resolves(false);
            configMock.getBrowserIds.returns(["chrome"]);

            const testDeps = { css: [], js: ["src/app.js"], modules: [] };
            testDepsReaderMock.getFor.resolves(testDeps);
            hashReaderMock.getTestChangedDeps.resolves(null); // No changes

            const disabledTestMock = {
                ...testMock,
                disabled: true,
            } as Test;

            runner.startTestCheckToRun(disabledTestMock, "chrome");
            await runner.runNecessaryTests();

            assert.calledOnce(runTestFnMock);
            assert.calledWith(runTestFnMock, disabledTestMock, "chrome");
            assert.notCalled(getTestDependenciesReaderStub);
            assert.notCalled(usedDumpsTrackerMock.trackUsed);
        });

        it("should track dumps when selectivity is in Enabled mode", async () => {
            browserConfigMock.selectivity.disableSelectivityPatterns = [];

            const testDeps = { css: [], js: ["src/app.js"], modules: [] };
            testDepsReaderMock.getFor.resolves(testDeps);
            hashReaderMock.getTestChangedDeps.resolves({ css: [], js: ["src/app.js"], modules: [] });

            runner.startTestCheckToRun(testMock, "chrome");
            await runner.runNecessaryTests();

            assert.calledOnceWith(usedDumpsTrackerMock.trackUsed, "test-123", "/test/path");
        });

        it("should run test if browser selectivity is disabled due to no patterns", async () => {
            browserConfigMock.selectivity.disableSelectivityPatterns = [];

            const testDeps = { css: [], js: ["src/app.js"], modules: [] };
            testDepsReaderMock.getFor.resolves(testDeps);
            hashReaderMock.getTestChangedDeps.resolves({ css: [], js: ["src/app.js"], modules: [] });

            runner.startTestCheckToRun(testMock, "chrome");

            await runner.runNecessaryTests();

            assert.calledOnce(runTestFnMock);
            assert.calledWith(runTestFnMock, testMock, "chrome");
        });

        it("should run test if browser selectivity is disabled due to pattern changes", async () => {
            browserConfigMock.selectivity.disableSelectivityPatterns = ["src/**/*.js"];
            hashReaderMock.patternHasChanged.resolves(true);

            runner.startTestCheckToRun(testMock, "chrome");

            await runner.runNecessaryTests();

            assert.calledOnce(runTestFnMock);
            assert.calledWith(runTestFnMock, testMock, "chrome");
            assert.calledWith(getHashReaderStub, "/test/path", "none");
            assert.calledWith(hashReaderMock.patternHasChanged, "src/**/*.js");
            assert.calledWith(
                debugSelectivityStub,
                'Disabling selectivity for chrome: file change by pattern "src/**/*.js" is detected',
            );
        });

        it("should run test if browser selectivity check throws error", async () => {
            browserConfigMock.selectivity.disableSelectivityPatterns = ["src/**/*.js"];
            const error = new Error("Pattern check failed");
            hashReaderMock.patternHasChanged.rejects(error);

            runner.startTestCheckToRun(testMock, "chrome");

            await runner.runNecessaryTests();

            assert.calledOnce(runTestFnMock);
            assert.calledWith(runTestFnMock, testMock, "chrome");
            assert.calledWith(
                debugSelectivityStub,
                "Disabling selectivity for chrome: got an error while checking 'disableSelectivityPatterns': %O",
                error,
            );
        });

        it("should run test if test should not be disabled by selectivity", async () => {
            browserConfigMock.selectivity.disableSelectivityPatterns = ["src/**/*.js"];
            hashReaderMock.patternHasChanged.resolves(false);

            const testDeps = { css: [], js: ["src/app.js"], modules: [] };
            const changedDeps = { css: [], js: ["src/app.js"], modules: [] };
            testDepsReaderMock.getFor.resolves(testDeps);
            hashReaderMock.getTestChangedDeps.resolves(changedDeps);

            runner.startTestCheckToRun(testMock, "chrome");

            await runner.runNecessaryTests();

            assert.calledOnce(runTestFnMock);
            assert.calledWith(runTestFnMock, testMock, "chrome");
            assert.calledWith(getTestDependenciesReaderStub, "/test/path", "none");
            assert.calledWith(testDepsReaderMock.getFor, testMock);
            assert.calledWith(hashReaderMock.getTestChangedDeps, testDeps);
            assert.calledWith(
                debugSelectivityStub,
                'Not disabling "Test Suite Test Case" as its dependencies were changed: %O',
                changedDeps,
            );
        });

        it("should not run test if test should be disabled by selectivity", async () => {
            browserConfigMock.selectivity.disableSelectivityPatterns = ["src/**/*.js"];
            hashReaderMock.patternHasChanged.resolves(false);

            const testDeps = { css: [], js: ["src/app.js"], modules: [] };
            testDepsReaderMock.getFor.resolves(testDeps);
            hashReaderMock.getTestChangedDeps.resolves(null); // No changes

            runner.startTestCheckToRun(testMock, "chrome");

            await runner.runNecessaryTests();

            assert.notCalled(runTestFnMock);
            assert.calledWith(getTestDependenciesReaderStub, "/test/path", "none");
            assert.calledWith(testDepsReaderMock.getFor, testMock);
            assert.calledWith(hashReaderMock.getTestChangedDeps, testDeps);
            assert.calledWith(
                debugSelectivityStub,
                'Disabling "Test Suite Test Case" as its dependencies were not changed',
            );
        });

        it("should not run test if test has no JS dependencies", async () => {
            browserConfigMock.selectivity.disableSelectivityPatterns = ["src/**/*.js"];
            hashReaderMock.patternHasChanged.resolves(false);

            const testDeps = { css: ["src/styles.css"], js: [], modules: [] };
            testDepsReaderMock.getFor.resolves(testDeps);

            runner.startTestCheckToRun(testMock, "chrome");

            await runner.runNecessaryTests();

            assert.calledOnce(runTestFnMock); // Should run because no JS deps means it's new
            assert.calledWith(runTestFnMock, testMock, "chrome");
            assert.calledWith(
                debugSelectivityStub,
                'Not disabling "Test Suite Test Case" as it has no js deps and therefore it was considered as new',
            );
            assert.notCalled(hashReaderMock.getTestChangedDeps);
        });

        it("should cache browser selectivity check results", async () => {
            browserConfigMock.selectivity.disableSelectivityPatterns = ["src/**/*.js"];
            hashReaderMock.patternHasChanged.resolves(false);

            const testDeps = { css: [], js: ["src/app.js"], modules: [] };
            testDepsReaderMock.getFor.resolves(testDeps);
            hashReaderMock.getTestChangedDeps.resolves(null);

            const test1 = { ...testMock, id: "test-1" } as Test;
            const test2 = { ...testMock, id: "test-2" } as Test;

            runner.startTestCheckToRun(test1, "chrome");
            runner.startTestCheckToRun(test2, "chrome");

            await runner.runNecessaryTests();

            assert.notCalled(runTestFnMock);
            assert.calledOnce(hashReaderMock.patternHasChanged); // Should be cached for same browser
            assert.calledTwice(testDepsReaderMock.getFor); // Called for each test
        });

        it("should handle different browsers separately", async () => {
            const chromeConfig = {
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    testDependenciesPath: "/test/chrome",
                    compression: "none",
                    disableSelectivityPatterns: ["src/**/*.js"],
                },
            };
            const firefoxConfig = {
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    testDependenciesPath: "/test/firefox",
                    compression: "gz",
                    disableSelectivityPatterns: ["test/**/*.js"],
                },
            };

            configMock.forBrowser.withArgs("chrome").returns(chromeConfig);
            configMock.forBrowser.withArgs("firefox").returns(firefoxConfig);

            hashReaderMock.patternHasChanged.resolves(false);
            const testDeps = { css: [], js: ["src/app.js"], modules: [] };
            testDepsReaderMock.getFor.resolves(testDeps);
            hashReaderMock.getTestChangedDeps.resolves(null);

            runner.startTestCheckToRun(testMock, "chrome");
            runner.startTestCheckToRun(testMock, "firefox");

            await runner.runNecessaryTests();

            assert.notCalled(runTestFnMock);
        });
    });

    describe("runNecessaryTests", () => {
        let runner: SelectivityRunner;

        beforeEach(() => {
            runner = new SelectivityRunnerClass(mainRunnerMock as any, configMock as any, runTestFnMock);
        });

        it("should resolve immediately if no tests are processing", async () => {
            await runner.runNecessaryTests();

            assert.notCalled(runTestFnMock);
        });

        it("should wait for all processing tests to complete", async () => {
            const browserConfigMock = {
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    testDependenciesPath: "/test/path",
                    compression: "none",
                    disableSelectivityPatterns: [],
                },
            };
            const testMock = {
                id: "test-123",
                browserId: "chrome",
                fullTitle: () => "Test Suite Test Case",
            } as Test;

            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.returns(browserConfigMock);

            const testDeps = { css: [], js: ["src/app.js"], modules: [] };
            testDepsReaderMock.getFor.resolves(testDeps);
            hashReaderMock.getTestChangedDeps.resolves({ css: [], js: ["src/app.js"], modules: [] });

            runner.startTestCheckToRun(testMock, "chrome");
            runner.startTestCheckToRun(testMock, "chrome");

            await runner.runNecessaryTests();

            assert.calledTwice(runTestFnMock);
        });
    });

    describe("onTestDependencies event handler", () => {
        it("should handle TEST_DEPENDENCIES event correctly", () => {
            const context = {
                testDependenciesPath: "/test/path",
                compression: "none",
                testId: "test-123",
                fullTitle: "Test Suite Test Case",
                browserId: "chrome",
            };
            const data = {
                css: ["src/styles.css"],
                js: ["src/app.js"],
                modules: ["react"],
            };

            new SelectivityRunnerClass(mainRunnerMock as any, configMock as any, runTestFnMock);

            const eventHandler = mainRunnerMock.on.getCall(0).args[1];
            eventHandler(context, data);

            assert.calledWith(getHashWriterStub, "/test/path", "none");
            assert.calledWith(hashWriterMock.addTestDependencyHashes, data);
        });
    });

    describe("saving selectivity report", () => {
        let runner: SelectivityRunner;
        let browserConfigMock: {
            selectivity: {
                enabled: SelectivityModeValue;
                testDependenciesPath: string;
                compression: string;
                disableSelectivityPatterns: string[];
                reportPath: string;
            };
        };
        let testMock: Test;

        beforeEach(() => {
            browserConfigMock = {
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    testDependenciesPath: "/test/path",
                    compression: "none",
                    disableSelectivityPatterns: ["src/**/*.js"],
                    reportPath: "/tmp/selectivity-report.json",
                },
            };
            testMock = {
                id: "test-123",
                browserId: "chrome",
                fullTitle: () => "Test Suite Test Case",
            } as Test;

            configMock.getBrowserIds.returns(["chrome"]);
            configMock.forBrowser.returns(browserConfigMock);

            hashReaderMock.patternHasChanged.resolves(false);

            runner = new SelectivityRunnerClass(mainRunnerMock as any, configMock as any, runTestFnMock);
        });

        it("should save report with correct stats when test is skipped", async () => {
            const testDeps = { css: [], js: ["src/app.js"], modules: [] };
            testDepsReaderMock.getFor.resolves(testDeps);
            hashReaderMock.getTestChangedDeps.resolves(null);

            runner.startTestCheckToRun(testMock, "chrome");
            await runner.runNecessaryTests();
            await new Promise(resolve => setTimeout(resolve, 0));

            assert.calledWith(
                fsExtraStub.outputJson,
                "/tmp/selectivity-report.json",
                {
                    totalProcessedCount: 1,
                    totalSkippedCount: 1,
                    perBrowserStats: {
                        chrome: { processedCount: 1, skippedCount: 1 },
                    },
                },
                { spaces: 4 },
            );
        });

        it("should save report with correct stats when test is not skipped", async () => {
            const testDeps = { css: [], js: ["src/app.js"], modules: [] };
            const changedDeps = { css: [], js: ["src/app.js"], modules: [] };
            testDepsReaderMock.getFor.resolves(testDeps);
            hashReaderMock.getTestChangedDeps.resolves(changedDeps);

            runner.startTestCheckToRun(testMock, "chrome");
            await runner.runNecessaryTests();
            await new Promise(resolve => setTimeout(resolve, 0));

            assert.calledWith(
                fsExtraStub.outputJson,
                "/tmp/selectivity-report.json",
                {
                    totalProcessedCount: 1,
                    totalSkippedCount: 0,
                    perBrowserStats: {
                        chrome: { processedCount: 1, skippedCount: 0 },
                    },
                },
                { spaces: 4 },
            );
        });

        it("should not save report when reportPath is empty", async () => {
            browserConfigMock.selectivity.reportPath = "";

            const testDeps = { css: [], js: ["src/app.js"], modules: [] };
            testDepsReaderMock.getFor.resolves(testDeps);
            hashReaderMock.getTestChangedDeps.resolves(null);

            runner.startTestCheckToRun(testMock, "chrome");
            await runner.runNecessaryTests();
            await new Promise(resolve => setTimeout(resolve, 0));

            assert.notCalled(fsExtraStub.outputJson);
        });

        it("should aggregate stats for multiple browsers with same reportPath", async () => {
            const chromeConfig = {
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    testDependenciesPath: "/test/chrome",
                    compression: "none",
                    disableSelectivityPatterns: ["src/**/*.js"],
                    reportPath: "/tmp/selectivity-report.json",
                },
            };
            const firefoxConfig = {
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    testDependenciesPath: "/test/firefox",
                    compression: "none",
                    disableSelectivityPatterns: ["src/**/*.js"],
                    reportPath: "/tmp/selectivity-report.json",
                },
            };

            configMock.forBrowser.withArgs("chrome").returns(chromeConfig);
            configMock.forBrowser.withArgs("firefox").returns(firefoxConfig);
            configMock.getBrowserIds.returns(["chrome", "firefox"]);

            const testDeps = { css: [], js: ["src/app.js"], modules: [] };
            testDepsReaderMock.getFor.resolves(testDeps);
            hashReaderMock.getTestChangedDeps.resolves(null);

            runner.startTestCheckToRun(testMock, "chrome");
            runner.startTestCheckToRun(testMock, "firefox");
            await runner.runNecessaryTests();
            await new Promise(resolve => setTimeout(resolve, 0));

            assert.calledOnce(fsExtraStub.outputJson);
            assert.calledWith(
                fsExtraStub.outputJson,
                "/tmp/selectivity-report.json",
                {
                    totalProcessedCount: 2,
                    totalSkippedCount: 2,
                    perBrowserStats: {
                        chrome: { processedCount: 1, skippedCount: 1 },
                        firefox: { processedCount: 1, skippedCount: 1 },
                    },
                },
                { spaces: 4 },
            );
        });

        it("should save separate reports for browsers with different reportPaths", async () => {
            const chromeConfig = {
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    testDependenciesPath: "/test/chrome",
                    compression: "none",
                    disableSelectivityPatterns: ["src/**/*.js"],
                    reportPath: "/tmp/chrome-report.json",
                },
            };
            const firefoxConfig = {
                selectivity: {
                    enabled: SelectivityMode.Enabled,
                    testDependenciesPath: "/test/firefox",
                    compression: "none",
                    disableSelectivityPatterns: ["src/**/*.js"],
                    reportPath: "/tmp/firefox-report.json",
                },
            };

            configMock.forBrowser.withArgs("chrome").returns(chromeConfig);
            configMock.forBrowser.withArgs("firefox").returns(firefoxConfig);
            configMock.getBrowserIds.returns(["chrome", "firefox"]);

            const testDeps = { css: [], js: ["src/app.js"], modules: [] };
            testDepsReaderMock.getFor.resolves(testDeps);
            hashReaderMock.getTestChangedDeps.resolves(null);

            runner.startTestCheckToRun(testMock, "chrome");
            runner.startTestCheckToRun(testMock, "firefox");
            await runner.runNecessaryTests();
            await new Promise(resolve => setTimeout(resolve, 0));

            assert.calledTwice(fsExtraStub.outputJson);
            assert.calledWith(
                fsExtraStub.outputJson,
                "/tmp/chrome-report.json",
                {
                    totalProcessedCount: 1,
                    totalSkippedCount: 1,
                    perBrowserStats: {
                        chrome: { processedCount: 1, skippedCount: 1 },
                    },
                },
                { spaces: 4 },
            );
            assert.calledWith(
                fsExtraStub.outputJson,
                "/tmp/firefox-report.json",
                {
                    totalProcessedCount: 1,
                    totalSkippedCount: 1,
                    perBrowserStats: {
                        firefox: { processedCount: 1, skippedCount: 1 },
                    },
                },
                { spaces: 4 },
            );
        });

        it("should use TESTPLANE_SELECTIVITY_REPORT_PATH env variable over config reportPath", async () => {
            const originalEnv = process.env.TESTPLANE_SELECTIVITY_REPORT_PATH;
            process.env.TESTPLANE_SELECTIVITY_REPORT_PATH = "/env/report.json";

            try {
                const testDeps = { css: [], js: ["src/app.js"], modules: [] };
                testDepsReaderMock.getFor.resolves(testDeps);
                hashReaderMock.getTestChangedDeps.resolves(null);

                runner.startTestCheckToRun(testMock, "chrome");
                await runner.runNecessaryTests();
                await new Promise(resolve => setTimeout(resolve, 0));

                assert.calledWith(fsExtraStub.outputJson, "/env/report.json", sinon.match.object, { spaces: 4 });
            } finally {
                if (originalEnv === undefined) {
                    delete process.env.TESTPLANE_SELECTIVITY_REPORT_PATH;
                } else {
                    process.env.TESTPLANE_SELECTIVITY_REPORT_PATH = originalEnv;
                }
            }
        });

        it("should log error when report saving fails", async () => {
            const error = new Error("write failed");
            fsExtraStub.outputJson.rejects(error);

            const testDeps = { css: [], js: ["src/app.js"], modules: [] };
            testDepsReaderMock.getFor.resolves(testDeps);
            hashReaderMock.getTestChangedDeps.resolves(null);

            runner.startTestCheckToRun(testMock, "chrome");
            await runner.runNecessaryTests();
            await new Promise(resolve => setTimeout(resolve, 0));

            assert.calledWith(loggerStub.error, "Couldn't save selectivity report. Reason:", error);
        });

        it("should not track stats for tests that bypass selectivity processing", async () => {
            browserConfigMock.selectivity.enabled = SelectivityMode.Disabled;

            runner.startTestCheckToRun(testMock, "chrome");
            await runner.runNecessaryTests();
            await new Promise(resolve => setTimeout(resolve, 0));

            assert.notCalled(fsExtraStub.outputJson);
        });
    });
});
