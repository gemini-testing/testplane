import sinon, { SinonStub } from "sinon";
import proxyquire from "proxyquire";

describe("CDP/Selectivity/TestDependenciesReader", () => {
    const sandbox = sinon.createSandbox();
    let TestDependenciesReader: any;
    let getTestDependenciesReader: typeof import("src/browser/cdp/selectivity/test-dependencies-reader").getTestDependenciesReader;
    let pathStub: { join: SinonStub };
    let readTestDependenciesStub: SinonStub;
    let mergeSourceDependenciesStub: SinonStub;

    beforeEach(() => {
        pathStub = {
            join: sandbox.stub().callsFake((...args) => args.join("/")),
        };
        readTestDependenciesStub = sandbox.stub();
        mergeSourceDependenciesStub = sandbox.stub();

        const proxyquiredModule = proxyquire("src/browser/cdp/selectivity/test-dependencies-reader", {
            "node:path": pathStub,
            "./utils": {
                readTestDependencies: readTestDependenciesStub,
                mergeSourceDependencies: mergeSourceDependenciesStub,
            },
        });

        TestDependenciesReader = proxyquiredModule.TestDependenciesReader;
        getTestDependenciesReader = proxyquiredModule.getTestDependenciesReader;
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("getFor", () => {
        const mockTest = {
            id: "test-123",
            title: "Test case",
            file: "test.js",
            location: { line: 1, column: 1 },
            fn: sandbox.stub(),
            clone: sandbox.stub(),
            assign: sandbox.stub(),
            browserId: "chrome",
        } as any;

        it("should return empty dependencies when no test dependencies exist", async () => {
            const reader = new TestDependenciesReader("/test/selectivity", "none");
            readTestDependenciesStub.resolves({});

            const result = await reader.getFor(mockTest);

            assert.deepEqual(result, { css: [], js: [], modules: [] });
            assert.calledWith(readTestDependenciesStub, "/test/selectivity/tests", mockTest, "none");
            assert.notCalled(mergeSourceDependenciesStub);
        });

        it("should return dependencies for single browser with single dependency type", async () => {
            const reader = new TestDependenciesReader("/test/selectivity", "none");
            const testDeps = {
                chrome: {
                    browser: { css: ["src/styles.css"], js: ["src/app.js"], modules: ["react"] },
                },
            };
            const expectedResult = { css: ["src/styles.css"], js: ["src/app.js"], modules: ["react"] };

            readTestDependenciesStub.resolves(testDeps);
            mergeSourceDependenciesStub.returns(expectedResult);

            const result = await reader.getFor(mockTest);

            assert.equal(result, expectedResult);
            assert.calledWith(mergeSourceDependenciesStub, { css: [], js: [], modules: [] }, testDeps.chrome.browser);
        });

        it("should merge dependencies for single browser with multiple dependency types", async () => {
            const reader = new TestDependenciesReader("/test/selectivity", "none");
            const testDeps = {
                chrome: {
                    browser: { css: ["src/styles.css"], js: ["src/app.js"], modules: ["react"] },
                    testplane: { css: ["src/testplane.css"], js: ["src/testplane.js"], modules: ["lodash"] },
                },
            };
            const mergedBrowserDeps = {
                css: ["src/styles.css", "src/testplane.css"],
                js: ["src/app.js", "src/testplane.js"],
                modules: ["react", "lodash"],
            };
            const finalResult = {
                css: ["src/styles.css", "src/testplane.css"],
                js: ["src/app.js", "src/testplane.js"],
                modules: ["react", "lodash"],
            };

            readTestDependenciesStub.resolves(testDeps);
            mergeSourceDependenciesStub.onFirstCall().returns(mergedBrowserDeps).onSecondCall().returns(finalResult);

            const result = await reader.getFor(mockTest);

            assert.equal(result, finalResult);
            assert.calledTwice(mergeSourceDependenciesStub);
            assert.calledWith(
                mergeSourceDependenciesStub.firstCall,
                testDeps.chrome.browser,
                testDeps.chrome.testplane,
            );
            assert.calledWith(
                mergeSourceDependenciesStub.secondCall,
                { css: [], js: [], modules: [] },
                mergedBrowserDeps,
            );
        });

        it("should merge dependencies across multiple browsers", async () => {
            const reader = new TestDependenciesReader("/test/selectivity", "none");
            const testDeps = {
                chrome: {
                    browser: { css: ["src/chrome.css"], js: ["src/chrome.js"], modules: ["react"] },
                },
                firefox: {
                    browser: { css: ["src/firefox.css"], js: ["src/firefox.js"], modules: ["vue"] },
                },
            };
            const chromeDeps = { css: ["src/chrome.css"], js: ["src/chrome.js"], modules: ["react"] };
            const finalResult = {
                css: ["src/chrome.css", "src/firefox.css"],
                js: ["src/chrome.js", "src/firefox.js"],
                modules: ["react", "vue"],
            };

            readTestDependenciesStub.resolves(testDeps);
            mergeSourceDependenciesStub.onFirstCall().returns(chromeDeps).onSecondCall().returns(finalResult);

            const result = await reader.getFor(mockTest);

            assert.equal(result, finalResult);
            assert.calledTwice(mergeSourceDependenciesStub);
            assert.calledWith(
                mergeSourceDependenciesStub.firstCall,
                { css: [], js: [], modules: [] },
                testDeps.chrome.browser,
            );
            assert.calledWith(mergeSourceDependenciesStub.secondCall, chromeDeps, testDeps.firefox.browser);
        });

        it("should handle complex scenario with multiple browsers and dependency types", async () => {
            const reader = new TestDependenciesReader("/test/selectivity", "none");
            const testDeps = {
                chrome: {
                    browser: { css: ["src/chrome-browser.css"], js: ["src/chrome-browser.js"], modules: ["react"] },
                    testplane: {
                        css: ["src/chrome-testplane.css"],
                        js: ["src/chrome-testplane.js"],
                        modules: ["lodash"],
                    },
                },
                firefox: {
                    browser: { css: ["src/firefox-browser.css"], js: ["src/firefox-browser.js"], modules: ["vue"] },
                    testplane: {
                        css: ["src/firefox-testplane.css"],
                        js: ["src/firefox-testplane.js"],
                        modules: ["axios"],
                    },
                },
            };

            const chromeMerged = { css: ["chrome-merged"], js: ["chrome-merged"], modules: ["chrome-merged"] };
            const firefoxMerged = { css: ["firefox-merged"], js: ["firefox-merged"], modules: ["firefox-merged"] };
            const finalResult = { css: ["final"], js: ["final"], modules: ["final"] };

            readTestDependenciesStub.resolves(testDeps);
            mergeSourceDependenciesStub
                .onCall(0)
                .returns(chromeMerged) // chrome testplane merge with empty result
                .onCall(1)
                .returns(chromeMerged) // chrome final merge (result + browserDeps)
                .onCall(2)
                .returns(firefoxMerged) // firefox testplane merge with empty browserDeps
                .onCall(3)
                .returns(finalResult); // firefox final merge (result + browserDeps) -> final result

            const result = await reader.getFor(mockTest);

            assert.equal(result, finalResult);
            assert.callCount(mergeSourceDependenciesStub, 4);
        });

        it("should skip browsers with no dependency types", async () => {
            const reader = new TestDependenciesReader("/test/selectivity", "none");
            const testDeps = {
                chrome: {},
                firefox: {
                    browser: { css: ["src/firefox.css"], js: ["src/firefox.js"], modules: ["vue"] },
                },
            };
            const firefoxDeps = { css: ["src/firefox.css"], js: ["src/firefox.js"], modules: ["vue"] };

            readTestDependenciesStub.resolves(testDeps);
            mergeSourceDependenciesStub.returns(firefoxDeps);

            const result = await reader.getFor(mockTest);

            assert.equal(result, firefoxDeps);
            assert.calledOnce(mergeSourceDependenciesStub);
            assert.calledWith(mergeSourceDependenciesStub, { css: [], js: [], modules: [] }, testDeps.firefox.browser);
        });

        it("should handle different compression types", async () => {
            const reader = new TestDependenciesReader("/test/selectivity", "br");
            const testDeps = {
                chrome: {
                    browser: { css: ["src/styles.css"], js: ["src/app.js"], modules: ["react"] },
                },
            };

            readTestDependenciesStub.resolves(testDeps);
            mergeSourceDependenciesStub.returns(testDeps.chrome.browser);

            await reader.getFor(mockTest);

            assert.calledWith(readTestDependenciesStub, "/test/selectivity/tests", mockTest, "br");
        });

        it("should handle empty dependency arrays", async () => {
            const reader = new TestDependenciesReader("/test/selectivity", "none");
            const testDeps = {
                chrome: {
                    browser: { css: [], js: [], modules: [] },
                },
            };
            const expectedResult = { css: [], js: [], modules: [] };

            readTestDependenciesStub.resolves(testDeps);
            mergeSourceDependenciesStub.returns(expectedResult);

            const result = await reader.getFor(mockTest);

            assert.equal(result, expectedResult);
            assert.calledWith(mergeSourceDependenciesStub, { css: [], js: [], modules: [] }, testDeps.chrome.browser);
        });

        it("should handle mixed empty and non-empty browsers", async () => {
            const reader = new TestDependenciesReader("/test/selectivity", "none");
            const testDeps = {
                chrome: {},
                firefox: {
                    browser: { css: ["src/styles.css"], js: [], modules: ["react"] },
                },
                safari: {},
                edge: {
                    testplane: { css: [], js: ["src/edge.js"], modules: [] },
                },
            };

            const firefoxResult = { css: ["src/styles.css"], js: [], modules: ["react"] };
            const finalResult = { css: ["src/styles.css"], js: ["src/edge.js"], modules: ["react"] };

            readTestDependenciesStub.resolves(testDeps);
            mergeSourceDependenciesStub.onFirstCall().returns(firefoxResult).onSecondCall().returns(finalResult);

            const result = await reader.getFor(mockTest);

            assert.equal(result, finalResult);
            assert.calledTwice(mergeSourceDependenciesStub);
        });
    });

    describe("getTestDependenciesReader", () => {
        it("should return memoized instance", () => {
            const path1 = "/test/path1";
            const path2 = "/test/path2";

            const reader1a = getTestDependenciesReader(path1, "none");
            const reader1b = getTestDependenciesReader(path1, "none");
            const reader2 = getTestDependenciesReader(path2, "none");

            assert.equal(reader1a, reader1b);
            assert.notEqual(reader1a, reader2);
        });

        it("should return different instances for different compression types", () => {
            const path = "/test/path";

            const readerNone = getTestDependenciesReader(path, "none");
            const readerGz = getTestDependenciesReader(path, "gz");

            assert.notEqual(readerNone, readerGz);
        });
    });
});
