import sinon, { SinonStub } from "sinon";
import proxyquire from "proxyquire";
import type { SelectivityRunner } from "src/browser/cdp/selectivity/runner";
import type { Test } from "src/types";
import { MasterEvents } from "src/events";

describe("SelectivityRunner", () => {
    const sandbox = sinon.createSandbox();
    let SelectivityRunnerClass: typeof SelectivityRunner;
    let debugSelectivityStub: SinonStub;
    let getHashReaderStub: SinonStub;
    let getHashWriterStub: SinonStub;
    let getTestDependenciesReaderStub: SinonStub;

    let mainRunnerMock: { on: SinonStub };
    let configMock: { forBrowser: SinonStub };
    let runTestFnMock: SinonStub;
    let hashReaderMock: { patternHasChanged: SinonStub; getTestChangedDeps: SinonStub };
    let hashWriterMock: { addTestDependencyHashes: SinonStub };
    let testDepsReaderMock: { getFor: SinonStub };

    beforeEach(() => {
        debugSelectivityStub = sandbox.stub();
        getHashReaderStub = sandbox.stub();
        getHashWriterStub = sandbox.stub();
        getTestDependenciesReaderStub = sandbox.stub();

        hashReaderMock = {
            patternHasChanged: sandbox.stub(),
            getTestChangedDeps: sandbox.stub(),
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
                enabled: boolean;
                testDependenciesPath: string;
                compression: string;
                disableSelectivityPatterns: string[];
            };
        };
        let testMock: Test;

        beforeEach(() => {
            browserConfigMock = {
                selectivity: {
                    enabled: true,
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

            configMock.forBrowser.returns(browserConfigMock);
            runner = new SelectivityRunnerClass(mainRunnerMock as any, configMock as any, runTestFnMock);
        });

        it("should run test if selectivity is disabled for browser", async () => {
            browserConfigMock.selectivity.enabled = false;

            runner.startTestCheckToRun(testMock, "chrome");
            await runner.runNecessaryTests();

            assert.calledOnce(runTestFnMock);
            assert.calledWith(runTestFnMock, testMock, "chrome");
        });

        it("should run test if shouldDisableSelectivity option is true", async () => {
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
        });

        it("should run test if both browser selectivity is disabled and shouldDisableSelectivity is true", async () => {
            browserConfigMock.selectivity.enabled = false;
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
                    enabled: true,
                    testDependenciesPath: "/test/chrome",
                    compression: "none",
                    disableSelectivityPatterns: ["src/**/*.js"],
                },
            };
            const firefoxConfig = {
                selectivity: {
                    enabled: true,
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
                    enabled: true,
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
});
