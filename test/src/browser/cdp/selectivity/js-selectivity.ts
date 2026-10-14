import sinon, { type SinonStub, type SinonStubbedInstance } from "sinon";
import proxyquire from "proxyquire";
import type { CDPTarget } from "src/browser/cdp/domains/target";
import type { CDPDebugger } from "src/browser/cdp/domains/debugger";
import type { CDPProfiler } from "src/browser/cdp/domains/profiler";
import type { CDPRuntime } from "src/browser/cdp/domains/runtime";
import type { CDP } from "src/browser/cdp";

describe("CDP/Selectivity/JSSelectivity", () => {
    const sandbox = sinon.createSandbox();
    let JSSelectivity: typeof import("src/browser/cdp/selectivity/js-selectivity").JSSelectivity;
    let cdpMock: {
        target: SinonStubbedInstance<CDPTarget>;
        debugger: SinonStubbedInstance<CDPDebugger>;
        profiler: SinonStubbedInstance<CDPProfiler>;
        runtime: SinonStubbedInstance<CDPRuntime>;
    };
    let fetchTextWithBrowserFallbackStub: SinonStub;
    let extractSourceFilesDepsStub: SinonStub;
    let parseSourceMapRangesStub: SinonStub;
    let urlResolveStub: SinonStub;
    let groupByStub: SinonStub;
    let isDataProtocolStub: SinonStub;

    const CacheType = { Asset: "a" };

    let getCachedSelectivityFileStub: SinonStub;
    let hasCachedSelectivityFileStub: SinonStub;
    let setCachedSelectivityFileStub: SinonStub;

    const sessionId = "test-session-id";
    const sourceRoot = "/test/source-root";

    beforeEach(() => {
        cdpMock = {
            target: { setAutoAttach: sandbox.stub().resolves() } as SinonStubbedInstance<CDPTarget>,
            debugger: {
                enable: sandbox.stub().resolves(),
                on: sandbox.stub(),
                off: sandbox.stub(),
                resume: sandbox.stub().resolves(),
                getScriptSource: sandbox
                    .stub()
                    .resolves({ scriptSource: "mock source\n//# sourceMappingURL=app.js.map" }),
            } as SinonStubbedInstance<CDPDebugger>,
            profiler: {
                enable: sandbox.stub().resolves(),
                startPreciseCoverage: sandbox.stub().resolves(),
                stopPreciseCoverage: sandbox.stub().resolves(),
                takePreciseCoverage: sandbox.stub().resolves({ result: [] }),
            } as SinonStubbedInstance<CDPProfiler>,
            runtime: {} as SinonStubbedInstance<CDPRuntime>,
        };

        fetchTextWithBrowserFallbackStub = sandbox.stub().resolves("mock source map");
        extractSourceFilesDepsStub = sandbox.stub().returns(new Set(["src/app.js", "src/utils.js"]));
        parseSourceMapRangesStub = sandbox.stub().resolves({ offset: [0], filename: ["src/app.js"] });
        urlResolveStub = sandbox.stub().returnsArg(1);
        groupByStub = sandbox.stub().callsFake((arr, key) => {
            const result: Record<string, any[]> = {};
            arr.forEach((item: any) => {
                const keyValue = item[key];
                if (!result[keyValue]) result[keyValue] = [];
                result[keyValue].push(item);
            });
            return result;
        });
        isDataProtocolStub = sandbox.stub().callsFake((url: string) => url.startsWith("data:"));

        getCachedSelectivityFileStub = sandbox.stub().resolves("mock source map");
        hasCachedSelectivityFileStub = sandbox.stub().resolves(false);
        setCachedSelectivityFileStub = sandbox.stub().resolves();

        JSSelectivity = proxyquire("src/browser/cdp/selectivity/js-selectivity", {
            lodash: { groupBy: groupByStub },
            "node:url": { resolve: urlResolveStub },
            "./utils": {
                extractSourceFilesDeps: extractSourceFilesDepsStub,
                parseSourceMapRanges: parseSourceMapRangesStub,
                fetchTextWithBrowserFallback: fetchTextWithBrowserFallbackStub,
                isDataProtocol: isDataProtocolStub,
            },
            "./fs-cache": {
                CacheType,
                getCachedSelectivityFile: getCachedSelectivityFileStub,
                hasCachedSelectivityFile: hasCachedSelectivityFileStub,
                setCachedSelectivityFile: setCachedSelectivityFileStub,
            },
        }).JSSelectivity;
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("start", () => {
        it("should set up CDP connections and start coverage", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            await jsSelectivity.start();

            assert.calledWith(cdpMock.profiler.startPreciseCoverage, sessionId, {
                callCount: false,
                detailed: false,
                allowTriggeredUpdates: false,
            });
            assert.calledOnce(cdpMock.debugger.on); // scriptParsed event only
        });

        it("should handle scriptParsed events when there is no cache", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);
            const hasCachedSelectivityFileStubResult = Promise.resolve(false);
            const fetchTextWithBrowserFallbackStubResult = Promise.resolve("src");
            hasCachedSelectivityFileStub.returns(hasCachedSelectivityFileStubResult);
            fetchTextWithBrowserFallbackStub.returns(fetchTextWithBrowserFallbackStubResult);

            await jsSelectivity.start();

            const scriptParsedHandler = cdpMock.debugger.on.getCall(0).args[1];

            const scriptParsedEvent = {
                scriptId: "script-123",
                url: "http://example.com/app.js",
                sourceMapURL: "app.js.map",
            };

            scriptParsedHandler(scriptParsedEvent, sessionId);

            await hasCachedSelectivityFileStubResult;
            await fetchTextWithBrowserFallbackStubResult;

            assert.calledWith(cdpMock.debugger.getScriptSource, sessionId, "script-123");
            assert.calledWith(fetchTextWithBrowserFallbackStub, "app.js.map", cdpMock.runtime, sessionId);
            assert.calledWith(setCachedSelectivityFileStub, CacheType.Asset, "app.js.map");
        });

        it("should handle scriptParsed events when there is cache", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);
            const hasCachedSelectivityFileStubResult = Promise.resolve(true);
            const getCachedSelectivityFileStubResult = Promise.resolve("src");
            hasCachedSelectivityFileStub.returns(hasCachedSelectivityFileStubResult);
            getCachedSelectivityFileStub.returns(getCachedSelectivityFileStubResult);

            await jsSelectivity.start();

            const scriptParsedHandler = cdpMock.debugger.on.getCall(0).args[1];

            const scriptParsedEvent = {
                scriptId: "script-123",
                url: "http://example.com/app.js",
                sourceMapURL: "app.js.map",
            };

            scriptParsedHandler(scriptParsedEvent, sessionId);

            await hasCachedSelectivityFileStubResult;

            assert.calledWith(hasCachedSelectivityFileStub, CacheType.Asset, "app.js.map");
            assert.calledWith(hasCachedSelectivityFileStub, CacheType.Asset, "http://example.com/app.js");
            assert.neverCalledWith(cdpMock.debugger.getScriptSource, sessionId, "script-123");
            assert.neverCalledWith(fetchTextWithBrowserFallbackStub, "app.js.map", cdpMock.runtime, sessionId);
            assert.neverCalledWith(setCachedSelectivityFileStub, CacheType.Asset, "app.js.map");
        });

        it("should handle scriptParsed events for inline source maps", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);
            const hasCachedSelectivityFileStubResult = Promise.resolve(true);
            const getCachedSelectivityFileStubResult = Promise.resolve("src");
            hasCachedSelectivityFileStub.returns(hasCachedSelectivityFileStubResult);
            getCachedSelectivityFileStub.returns(getCachedSelectivityFileStubResult);

            await jsSelectivity.start();

            const scriptParsedHandler = cdpMock.debugger.on.getCall(0).args[1];

            const sourceMapURL = "data:application/json;base64,eyJ2ZXJzaW9uIjozfQ==";
            const scriptParsedEvent = {
                scriptId: "script-123",
                url: "http://example.com/app.js",
                sourceMapURL: "data:application/json;base64,eyJ2ZXJzaW9uIjozfQ==",
            };

            scriptParsedHandler(scriptParsedEvent, sessionId);

            await hasCachedSelectivityFileStubResult;

            assert.neverCalledWith(hasCachedSelectivityFileStub, CacheType.Asset, sourceMapURL);
            assert.calledWith(fetchTextWithBrowserFallbackStub, sourceMapURL);
        });

        it("should handle scriptParsed events without URL or sourceMapURL", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            await jsSelectivity.start();

            const scriptParsedHandler = cdpMock.debugger.on.getCall(0).args[1];

            const scriptParsedEvent = {
                scriptId: "script-123",
                url: "",
                sourceMapURL: "",
            };

            scriptParsedHandler(scriptParsedEvent, sessionId);

            assert.notCalled(cdpMock.debugger.getScriptSource);
            assert.notCalled(fetchTextWithBrowserFallbackStub);
        });
    });

    describe("takeCoverageSnapshot", () => {
        it("should call takePreciseCoverage with sessionId", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            await jsSelectivity.start();
            await jsSelectivity.takeCoverageSnapshot();

            assert.calledWith(cdpMock.profiler.takePreciseCoverage, sessionId);
        });

        it("should fetch sources for unknown scripts", async () => {
            cdpMock.profiler.takePreciseCoverage.resolves({
                timestamp: 100500,
                result: [
                    {
                        scriptId: "script-999",
                        url: "http://example.com/bundle.js",
                        functions: [
                            {
                                functionName: "bar",
                                isBlockCoverage: false,
                                ranges: [{ startOffset: 0, endOffset: 30, count: 1 }],
                            },
                        ],
                    },
                ],
            });
            cdpMock.debugger.getScriptSource.resolves({
                scriptSource: "mock source\n//# sourceMappingURL=bundle.js.map",
            });

            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            await jsSelectivity.start();
            await jsSelectivity.takeCoverageSnapshot();

            assert.calledWith(cdpMock.debugger.getScriptSource, sessionId, "script-999");
        });

        it("should not re-fetch already known scripts", async () => {
            cdpMock.profiler.takePreciseCoverage.resolves({
                timestamp: 100500,
                result: [
                    {
                        scriptId: "script-123",
                        url: "http://example.com/app.js",
                        functions: [
                            {
                                functionName: "foo",
                                isBlockCoverage: false,
                                ranges: [{ startOffset: 0, endOffset: 30, count: 1 }],
                            },
                        ],
                    },
                ],
            });

            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            await jsSelectivity.start();

            const scriptParsedHandler = cdpMock.debugger.on.getCall(0).args[1];
            scriptParsedHandler(
                { scriptId: "script-123", url: "http://example.com/app.js", sourceMapURL: "app.js.map" },
                sessionId,
            );

            await jsSelectivity.takeCoverageSnapshot();

            // getScriptSource is called by _processScript (from scriptParsed), not by _ensureScriptsAreLoading
            assert.calledOnce(cdpMock.debugger.getScriptSource);
        });

        it("should accumulate coverage results used by stop()", async () => {
            cdpMock.profiler.takePreciseCoverage
                .onFirstCall()
                .resolves({
                    timestamp: 100500,
                    result: [
                        {
                            scriptId: "script-123",
                            url: "http://example.com/app.js",
                            functions: [
                                {
                                    functionName: "foo",
                                    isBlockCoverage: false,
                                    ranges: [{ startOffset: 0, endOffset: 30, count: 1 }],
                                },
                            ],
                        },
                    ],
                })
                .onSecondCall()
                .resolves({
                    timestamp: 100600,
                    result: [
                        {
                            scriptId: "script-123",
                            url: "http://example.com/app.js",
                            functions: [
                                {
                                    functionName: "bar",
                                    isBlockCoverage: false,
                                    ranges: [{ startOffset: 30, endOffset: 60, count: 1 }],
                                },
                            ],
                        },
                    ],
                });
            cdpMock.debugger.getScriptSource.resolves({
                scriptSource: "mock source\n//# sourceMappingURL=app.js.map",
            });
            extractSourceFilesDepsStub.returns(new Set(["src/app.js"]));

            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            await jsSelectivity.start();
            await jsSelectivity.takeCoverageSnapshot();
            const result = await jsSelectivity.stop();

            assert.deepEqual(Array.from(result || []), ["src/app.js"]);
            // takePreciseCoverage is called once by takeCoverageSnapshot and once by stop
            assert.calledTwice(cdpMock.profiler.takePreciseCoverage);
        });
    });

    describe("page boundaries", () => {
        const coverageForScript = (scriptId: string, url: string): any => ({
            timestamp: 1,
            result: [
                {
                    scriptId,
                    url,
                    functions: [
                        {
                            functionName: "f",
                            isBlockCoverage: false,
                            ranges: [{ startOffset: 0, endOffset: 10, count: 1 }],
                        },
                    ],
                },
            ],
        });

        it("takeCoverageSnapshot should NOT reset precise coverage (leaving page still alive)", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            await jsSelectivity.start();
            await jsSelectivity.takeCoverageSnapshot();

            assert.notCalled(cdpMock.profiler.stopPreciseCoverage);
        });

        it("flushPage should reset precise coverage", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            await jsSelectivity.start();
            await jsSelectivity.flushPage();

            assert.calledOnceWith(cdpMock.profiler.stopPreciseCoverage, sessionId);
            // once in start(), once when resetting in flushPage
            assert.calledTwice(cdpMock.profiler.startPreciseCoverage);
            assert.alwaysCalledWith(cdpMock.profiler.startPreciseCoverage, sessionId, {
                callCount: false,
                detailed: false,
                allowTriggeredUpdates: false,
            });
        });

        it("should load an unavailable stale script by URL at a page boundary", async () => {
            const scriptId = "42";
            const sourceUrl = "https://mc.yandex.ru/metrika/watch.js";
            const missingScriptError = Object.assign(
                new Error(`No script for id: ${scriptId}\n\tErrorCode: -32000\n\tRequest ID: 56`),
                { code: -32000 },
            );
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            cdpMock.profiler.takePreciseCoverage.resolves(coverageForScript(scriptId, sourceUrl));
            cdpMock.debugger.getScriptSource.rejects(missingScriptError);
            fetchTextWithBrowserFallbackStub.resolves("source without source maps");

            await jsSelectivity.start();
            await jsSelectivity.flushPage();

            assert.calledOnceWithExactly(fetchTextWithBrowserFallbackStub, sourceUrl, cdpMock.runtime, sessionId);
            assert.notCalled(parseSourceMapRangesStub);
            assert.notCalled(extractSourceFilesDepsStub);
        });

        it("should preserve unload-tail dependencies loaded through the source URL fallback", async () => {
            const scriptId = "42";
            const sourceUrl = "https://example.com/app.js";
            const missingScriptError = Object.assign(
                new Error(`No script for id: ${scriptId}\n\tErrorCode: -32000\n\tRequest ID: 56`),
                { code: -32000 },
            );
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            cdpMock.profiler.takePreciseCoverage
                .onFirstCall()
                .resolves(coverageForScript(scriptId, sourceUrl))
                .onSecondCall()
                .resolves({ timestamp: 2, result: [] });
            cdpMock.debugger.getScriptSource.rejects(missingScriptError);
            fetchTextWithBrowserFallbackStub.resolves("source\n//# sourceMappingURL=app.js.map");

            await jsSelectivity.start();
            await jsSelectivity.flushPage();

            const dependencies = await jsSelectivity.stop();

            assert.deepEqual(Array.from(dependencies || []).sort(), ["src/app.js", "src/utils.js"]);
            assert.calledOnceWithExactly(fetchTextWithBrowserFallbackStub, sourceUrl, cdpMock.runtime, sessionId);
        });

        it("should fall back when stale source loading was started by scriptParsed", async () => {
            const scriptId = "42";
            const sourceUrl = "https://mc.yandex.ru/metrika/watch.js";
            const missingScriptError = Object.assign(
                new Error(`No script for id: ${scriptId}\n\tErrorCode: -32000\n\tRequest ID: 56`),
                { code: -32000 },
            );
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            cdpMock.profiler.takePreciseCoverage.resolves(coverageForScript(scriptId, sourceUrl));
            cdpMock.debugger.getScriptSource.rejects(missingScriptError);
            fetchTextWithBrowserFallbackStub.callsFake((url: string) => {
                return Promise.resolve(url === sourceUrl ? "source" : "source map");
            });

            await jsSelectivity.start();

            const scriptParsedHandler = cdpMock.debugger.on.getCall(0).args[1];

            scriptParsedHandler({ scriptId, url: sourceUrl, sourceMapURL: "watch.js.map" }, sessionId);

            await jsSelectivity.flushPage();

            assert.calledOnceWithExactly(cdpMock.debugger.getScriptSource, sessionId, scriptId);
            assert.calledWithExactly(fetchTextWithBrowserFallbackStub, sourceUrl, cdpMock.runtime, sessionId);
        });

        it("should fail a page boundary when the source URL fallback also fails", async () => {
            const scriptId = "42";
            const sourceUrl = "https://mc.yandex.ru/metrika/watch.js";
            const missingScriptError = Object.assign(new Error(`No script for id: ${scriptId}`), { code: -32000 });
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            cdpMock.profiler.takePreciseCoverage.resolves(coverageForScript(scriptId, sourceUrl));
            cdpMock.debugger.getScriptSource.rejects(missingScriptError);
            fetchTextWithBrowserFallbackStub.rejects(new Error("fetch failed"));

            await jsSelectivity.start();

            await assert.isRejected(
                jsSelectivity.flushPage(),
                `JS Selectivity: Couldn't load source code from ${sourceUrl}`,
            );
        });

        for (const error of [
            Object.assign(new Error("No script for id: 420"), { code: -32000 }),
            Object.assign(new Error("No script for id: 42"), { code: -32001 }),
        ]) {
            it(`should not ignore a different missing-script error at a page boundary: ${error.message}`, async () => {
                const scriptId = "42";
                const sourceUrl = "https://mc.yandex.ru/metrika/watch.js";
                const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

                cdpMock.profiler.takePreciseCoverage.resolves(coverageForScript(scriptId, sourceUrl));
                cdpMock.debugger.getScriptSource.rejects(error);

                await jsSelectivity.start();

                await assert.isRejected(
                    jsSelectivity.flushPage(),
                    `JS Selectivity: Couldn't load source code from ${sourceUrl}`,
                );
            });
        }

        it("should not ignore an unavailable script while stopping", async () => {
            const scriptId = "42";
            const sourceUrl = "https://mc.yandex.ru/metrika/watch.js";
            const missingScriptError = Object.assign(
                new Error(`No script for id: ${scriptId}\n\tErrorCode: -32000\n\tRequest ID: 56`),
                { code: -32000 },
            );
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            cdpMock.profiler.takePreciseCoverage.resolves(coverageForScript(scriptId, sourceUrl));
            cdpMock.debugger.getScriptSource.rejects(missingScriptError);
            fetchTextWithBrowserFallbackStub.rejects(new Error("fetch failed"));

            await jsSelectivity.start();

            await assert.isRejected(
                jsSelectivity.stop(),
                `JS Selectivity: Couldn't load source code from ${sourceUrl}`,
            );
        });

        it("flushPage should clear script maps so a reused scriptId is treated as a new script", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            await jsSelectivity.start();

            const scriptParsedHandler = cdpMock.debugger.on.getCall(0).args[1];

            // Page 1: script "10" belongs to http://page1/app.js
            scriptParsedHandler({ scriptId: "10", url: "http://page1/app.js", sourceMapURL: "app.js.map" }, sessionId);

            await jsSelectivity.flushPage();

            // Page 2 reuses scriptId "10" for a different script
            scriptParsedHandler({ scriptId: "10", url: "http://page2/app.js", sourceMapURL: "app.js.map" }, sessionId);

            cdpMock.profiler.takePreciseCoverage.resolves({ timestamp: 2, result: [] });
            await jsSelectivity.stop();

            // Maps were cleared on flushPage, so page 2's "10" is fetched fresh instead of reusing page 1's mapping
            assert.calledTwice(cdpMock.debugger.getScriptSource);
            assert.alwaysCalledWith(cdpMock.debugger.getScriptSource, sessionId, "10");
        });

        it("should re-resolve a scriptId reused for different content (hash change) within one page", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            await jsSelectivity.start();

            const scriptParsedHandler = cdpMock.debugger.on.getCall(0).args[1];

            // Same scriptId "10", first script (hash AAA)
            scriptParsedHandler(
                { scriptId: "10", url: "http://page/a.js", sourceMapURL: "a.js.map", hash: "AAA" },
                sessionId,
            );

            // scriptId "10" reused for a DIFFERENT script (hash BBB) — no page boundary in between
            scriptParsedHandler(
                { scriptId: "10", url: "http://page/b.js", sourceMapURL: "b.js.map", hash: "BBB" },
                sessionId,
            );

            cdpMock.profiler.takePreciseCoverage.resolves({ timestamp: 1, result: [] });
            await jsSelectivity.stop();

            // Hash change drops the stale mapping, so the new script is fetched fresh instead of reusing a.js
            assert.calledTwice(cdpMock.debugger.getScriptSource);
            assert.alwaysCalledWith(cdpMock.debugger.getScriptSource, sessionId, "10");
        });

        it("should propagate (not swallow) when coverage fails to resolve", async () => {
            hasCachedSelectivityFileStub.resolves(false);
            getCachedSelectivityFileStub.resolves(null);
            cdpMock.debugger.getScriptSource.rejects(new Error("boom"));
            cdpMock.profiler.takePreciseCoverage.resolves(coverageForScript("3", "http://page1/app.js"));

            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            await jsSelectivity.start();

            // Missing a dependency is worse than failing the test — the error must surface, not be swallowed
            await assert.isRejected(
                jsSelectivity.takeCoverageSnapshot(),
                "JS Selectivity: Couldn't load source code from http://page1/app.js",
            );
        });
    });

    describe("unhashed scriptId reuse", () => {
        const scriptId = "reused-id";
        const generatedSource = "function used() { return 'used'; }";
        const sourceUrlFor = (name: string): string => `http://example.com/${name}.js`;
        const sourceFor = (name: string): string => `${generatedSource}\n//# sourceMappingURL=${name}.js.map`;
        const sourceMapFor = (name: string): string =>
            JSON.stringify({
                version: 3,
                sources: [`src/${name}.js`],
                sourcesContent: [generatedSource],
                names: [],
                mappings: "AAAA",
            });
        const coverageFor = (name: string): any => ({
            timestamp: 1,
            result: [
                {
                    scriptId,
                    url: sourceUrlFor(name),
                    functions: [
                        {
                            functionName: "used",
                            isBlockCoverage: false,
                            ranges: [{ startOffset: 0, endOffset: generatedSource.length, count: 1 }],
                        },
                    ],
                },
            ],
        });

        beforeEach(() => {
            // Keep production acquisition, parsing and extraction. No actual cache or network I/O is performed.
            getCachedSelectivityFileStub.resolves(null);
            setCachedSelectivityFileStub.rejects(new Error("File cache disabled"));
            const fsCacheStubs = {
                getCachedSelectivityFile: getCachedSelectivityFileStub,
                hasCachedSelectivityFile: hasCachedSelectivityFileStub,
                setCachedSelectivityFile: setCachedSelectivityFileStub,
            };
            const utils = proxyquire("src/browser/cdp/selectivity/utils", { "./fs-cache": fsCacheStubs });

            JSSelectivity = proxyquire("src/browser/cdp/selectivity/js-selectivity", {
                "./utils": { ...utils, fetchTextWithBrowserFallback: fetchTextWithBrowserFallbackStub },
                "./fs-cache": fsCacheStubs,
            }).JSSelectivity;
            cdpMock.debugger.getScriptSource
                .onFirstCall()
                .resolves({ scriptSource: sourceFor("a") })
                .onSecondCall()
                .resolves({ scriptSource: sourceFor("b") });
            fetchTextWithBrowserFallbackStub.callsFake((url: string) => {
                return Promise.resolve(sourceMapFor(url.endsWith("/a.js.map") ? "a" : "b"));
            });
            cdpMock.profiler.takePreciseCoverage.resolves(coverageFor("a"));
        });

        for (const excludeOldSource of [true, false]) {
            it(`should protect new parsed assets from an old ${
                excludeOldSource ? "excluded" : "mapped"
            } fallback`, async () => {
                let resolveSource!: (value: { scriptSource: string }) => void;
                let notifyRequested!: () => void;
                const sourceA = new Promise<{ scriptSource: string }>(resolve => {
                    resolveSource = resolve;
                });
                const sourceRequested = new Promise<void>(resolve => {
                    notifyRequested = resolve;
                });
                const mapUrlFor = (name: string): string => `http://maps.example.com/${name}.js.map`;
                cdpMock.debugger.getScriptSource.onFirstCall().callsFake(() => {
                    notifyRequested();
                    return sourceA;
                });
                if (!excludeOldSource) {
                    const assets = new Map([
                        [sourceUrlFor("b"), sourceFor("b")],
                        [mapUrlFor("b"), sourceMapFor("b")],
                    ]);
                    hasCachedSelectivityFileStub.callsFake((_type: string, key: string) =>
                        Promise.resolve(assets.has(key)),
                    );
                    getCachedSelectivityFileStub.callsFake((_type: string, key: string) =>
                        Promise.resolve(assets.get(key) ?? null),
                    );
                    setCachedSelectivityFileStub.callsFake((_type: string, key: string, value: string) => {
                        assets.set(key, value);
                        return Promise.resolve();
                    });
                }
                const jsSelectivity = new JSSelectivity(
                    cdpMock as unknown as CDP,
                    sessionId,
                    sourceRoot,
                    ({ sourceUrl }) =>
                        excludeOldSource
                            ? sourceUrl !== sourceUrlFor("a")
                            : sourceUrl.replace("example.com", "maps.example.com") + ".map",
                );

                await jsSelectivity.start();
                const snapshot = jsSelectivity.takeCoverageSnapshot();
                await sourceRequested;
                cdpMock.debugger.on
                    .getCall(0)
                    .args[1]({ scriptId, url: sourceUrlFor("b"), sourceMapURL: "b.js.map", hash: "BBB" }, sessionId);
                cdpMock.profiler.takePreciseCoverage.resolves({ timestamp: 2, result: [] });
                await jsSelectivity.takeCoverageSnapshot();
                resolveSource({ scriptSource: sourceFor("a") });
                await snapshot;
                cdpMock.profiler.takePreciseCoverage.resolves(coverageFor("b"));

                const dependencies = await jsSelectivity.stop();

                // Attribution of the old snapshot is covered by the separate snapshot fix.
                // This regression must preserve the new script's real source and map in either ordering.
                assert.include(Array.from(dependencies || []), `${sourceRoot}/src/b.js`);
                assert.callCount(cdpMock.debugger.getScriptSource, excludeOldSource ? 2 : 1);
                if (!excludeOldSource) {
                    assert.calledWith(getCachedSelectivityFileStub, sinon.match.any, mapUrlFor("b"));
                }
                assert.notCalled(parseSourceMapRangesStub);
                assert.notCalled(extractSourceFilesDepsStub);
            });
        }

        it("should reload an unhashed fallback when the first parsed hash has a different URL", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            await jsSelectivity.start();
            await jsSelectivity.takeCoverageSnapshot(); // Script a was discovered only through coverage.
            cdpMock.debugger.on
                .getCall(0)
                .args[1]({ scriptId, url: sourceUrlFor("b"), sourceMapURL: "b.js.map", hash: "BBB" }, sessionId);
            cdpMock.profiler.takePreciseCoverage.resolves(coverageFor("b"));

            const dependencies = await jsSelectivity.stop();

            assert.deepEqual(Array.from(dependencies || []).sort(), [
                `${sourceRoot}/src/a.js`,
                `${sourceRoot}/src/b.js`,
            ]);
            assert.calledTwice(cdpMock.debugger.getScriptSource);
            assert.alwaysCalledWithExactly(cdpMock.debugger.getScriptSource, sessionId, scriptId);
            assert.calledWithExactly(
                fetchTextWithBrowserFallbackStub,
                "http://example.com/a.js.map",
                cdpMock.runtime,
                sessionId,
            );
            assert.calledWithExactly(
                fetchTextWithBrowserFallbackStub,
                "http://example.com/b.js.map",
                cdpMock.runtime,
                sessionId,
            );
            assert.notCalled(parseSourceMapRangesStub);
            assert.notCalled(extractSourceFilesDepsStub);
        });

        it("should retain an unhashed fallback when parsed metadata has the same URL", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            await jsSelectivity.start();
            await jsSelectivity.takeCoverageSnapshot();
            cdpMock.debugger.on
                .getCall(0)
                .args[1]({ scriptId, url: sourceUrlFor("a"), sourceMapURL: "a.js.map", hash: "AAA" }, sessionId);

            const dependencies = await jsSelectivity.stop();

            assert.deepEqual(Array.from(dependencies || []), [`${sourceRoot}/src/a.js`]);
            assert.calledOnceWithExactly(cdpMock.debugger.getScriptSource, sessionId, scriptId);
            assert.calledOnceWithExactly(
                fetchTextWithBrowserFallbackStub,
                "http://example.com/a.js.map",
                cdpMock.runtime,
                sessionId,
            );
        });
    });

    describe("pending coverage state", () => {
        const scriptId = "pending-id";
        const generatedSource = "function used() { return 'used'; }";
        const sourceUrlFor = (name: string): string => `http://example.com/${name}.js`;
        const sourceFor = (name: string): string => `${generatedSource}\n//# sourceMappingURL=${name}.js.map`;
        const sourceMapFor = (name: string): string =>
            JSON.stringify({
                version: 3,
                sources: [`src/${name}.js`],
                sourcesContent: [generatedSource],
                names: [],
                mappings: "AAAA",
            });
        const coverageFor = (name: string): any => ({
            timestamp: 1,
            result: [
                {
                    scriptId,
                    url: sourceUrlFor(name),
                    functions: [
                        {
                            functionName: "used",
                            isBlockCoverage: false,
                            ranges: [{ startOffset: 0, endOffset: generatedSource.length, count: 1 }],
                        },
                    ],
                },
            ],
        });
        const deferred = <T>(): { promise: Promise<T>; resolve: (value: T) => void } => {
            let resolve!: (value: T) => void;
            const promise = new Promise<T>(fulfill => {
                resolve = fulfill;
            });

            return { promise, resolve };
        };

        beforeEach(() => {
            // Run the production collector, parser and extractor, with only asset/cache I/O stubbed.
            getCachedSelectivityFileStub.resolves(null);
            setCachedSelectivityFileStub.rejects(new Error("File cache disabled"));
            const fsCacheStubs = {
                getCachedSelectivityFile: getCachedSelectivityFileStub,
                hasCachedSelectivityFile: hasCachedSelectivityFileStub,
                setCachedSelectivityFile: setCachedSelectivityFileStub,
            };
            const utils = proxyquire("src/browser/cdp/selectivity/utils", { "./fs-cache": fsCacheStubs });

            JSSelectivity = proxyquire("src/browser/cdp/selectivity/js-selectivity", {
                "./utils": { ...utils, fetchTextWithBrowserFallback: fetchTextWithBrowserFallbackStub },
                "./fs-cache": fsCacheStubs,
            }).JSSelectivity;
            cdpMock.debugger.getScriptSource.resolves({ scriptSource: sourceFor("b") });
            fetchTextWithBrowserFallbackStub.callsFake((url: string) => {
                return Promise.resolve(sourceMapFor(url.endsWith("/a.js.map") ? "a" : "b"));
            });
            cdpMock.profiler.takePreciseCoverage.resolves(coverageFor("a"));
        });

        for (const method of ["takeCoverageSnapshot", "flushPage"] as const) {
            for (const laterCoverage of [false, true]) {
                it(`${method} should retain pending A when parsed B reuses its id${
                    laterCoverage ? " and union later B coverage" : " without attributing A coverage to B"
                }`, async () => {
                    const sourceA = deferred<{ scriptSource: string }>();
                    const sourceRequested = deferred<void>();
                    cdpMock.debugger.getScriptSource.onFirstCall().callsFake(() => {
                        sourceRequested.resolve();
                        return sourceA.promise;
                    });
                    const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

                    await jsSelectivity.start();
                    const scriptParsed = cdpMock.debugger.on.getCall(0).args[1];
                    scriptParsed(
                        { scriptId, url: sourceUrlFor("a"), sourceMapURL: "a.js.map", hash: "AAA" },
                        sessionId,
                    );

                    const snapshot = jsSelectivity[method]();
                    await sourceRequested.promise;
                    scriptParsed(
                        { scriptId, url: sourceUrlFor("b"), sourceMapURL: "b.js.map", hash: "BBB" },
                        sessionId,
                    );
                    sourceA.resolve({ scriptSource: sourceFor("a") });
                    await snapshot;
                    cdpMock.profiler.takePreciseCoverage.resolves(
                        laterCoverage ? coverageFor("b") : { timestamp: 2, result: [] },
                    );

                    const dependencies = await jsSelectivity.stop();

                    assert.deepEqual(
                        Array.from(dependencies || []).sort(),
                        laterCoverage
                            ? [`${sourceRoot}/src/a.js`, `${sourceRoot}/src/b.js`]
                            : [`${sourceRoot}/src/a.js`],
                    );
                    assert.notCalled(parseSourceMapRangesStub);
                    assert.notCalled(extractSourceFilesDepsStub);
                });
            }
        }

        it("should capture pending fs-cache asset URLs together with the snapshot states", async () => {
            const cacheA = deferred<boolean>();
            hasCachedSelectivityFileStub.callsFake((_type: string, url: string) => {
                return url === sourceUrlFor("a") ? cacheA.promise : Promise.resolve(true);
            });
            getCachedSelectivityFileStub.callsFake((_type: string, url: string) => {
                if (url === sourceUrlFor("a") || url === sourceUrlFor("b")) {
                    return Promise.resolve(sourceFor(url.endsWith("/a.js") ? "a" : "b"));
                }
                if (url === `${sourceUrlFor("a")}.map` || url === `${sourceUrlFor("b")}.map`) {
                    return Promise.resolve(sourceMapFor(url.endsWith("/a.js.map") ? "a" : "b"));
                }

                return Promise.resolve(null);
            });
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            await jsSelectivity.start();
            const scriptParsed = cdpMock.debugger.on.getCall(0).args[1];
            scriptParsed({ scriptId, url: sourceUrlFor("a"), sourceMapURL: "a.js.map", hash: "AAA" }, sessionId);

            const snapshot = jsSelectivity.takeCoverageSnapshot();
            // The coverage response resumes before this checkpoint, while the old source cache lookup stays pending.
            await Promise.resolve();
            scriptParsed({ scriptId, url: sourceUrlFor("b"), sourceMapURL: "b.js.map", hash: "BBB" }, sessionId);
            cacheA.resolve(true);
            await snapshot;
            cdpMock.profiler.takePreciseCoverage.resolves({ timestamp: 2, result: [] });

            const dependencies = await jsSelectivity.stop();

            assert.deepEqual(Array.from(dependencies || []), [`${sourceRoot}/src/a.js`]);
            assert.calledWith(getCachedSelectivityFileStub, sinon.match.any, sourceUrlFor("a"));
            assert.calledWith(getCachedSelectivityFileStub, sinon.match.any, `${sourceUrlFor("a")}.map`);
            assert.notCalled(cdpMock.debugger.getScriptSource);
            assert.notCalled(fetchTextWithBrowserFallbackStub);
        });

        it("should still wait for pending parsed assets before resetting an empty page", async () => {
            const sourceA = deferred<{ scriptSource: string }>();
            const sourceRequested = deferred<void>();
            cdpMock.debugger.getScriptSource.onFirstCall().callsFake(() => {
                sourceRequested.resolve();
                return sourceA.promise;
            });
            cdpMock.profiler.takePreciseCoverage.resolves({ timestamp: 1, result: [] });
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            await jsSelectivity.start();
            cdpMock.debugger.on
                .getCall(0)
                .args[1]({ scriptId, url: sourceUrlFor("a"), sourceMapURL: "a.js.map", hash: "AAA" }, sessionId);

            const flush = jsSelectivity.flushPage();
            await sourceRequested.promise;
            assert.notCalled(cdpMock.profiler.stopPreciseCoverage);
            assert.calledOnce(cdpMock.profiler.startPreciseCoverage);
            sourceA.resolve({ scriptSource: sourceFor("a") });
            await flush;

            assert.calledOnceWithExactly(cdpMock.profiler.stopPreciseCoverage, sessionId);
            assert.calledTwice(cdpMock.profiler.startPreciseCoverage);
            assert.deepEqual(Array.from((await jsSelectivity.stop()) || []), []);
        });
    });

    describe("original source extensions", () => {
        beforeEach(() => {
            // Keep the production collector, source-map parser and coverage extractor. Only I/O is stubbed.
            const fsCacheStubs = {
                getCachedSelectivityFile: sandbox.stub().resolves(null),
                hasCachedSelectivityFile: sandbox.stub().resolves(false),
                setCachedSelectivityFile: sandbox.stub().rejects(new Error("File cache disabled")),
            };
            const utils = proxyquire("src/browser/cdp/selectivity/utils", { "./fs-cache": fsCacheStubs });

            JSSelectivity = proxyquire("src/browser/cdp/selectivity/js-selectivity", {
                "./utils": { ...utils, fetchTextWithBrowserFallback: fetchTextWithBrowserFallbackStub },
                "./fs-cache": fsCacheStubs,
            }).JSSelectivity;
        });

        const originals = [
            ...[".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts"].map(extension => ({
                extension,
                contents: "export function render() { return 'used'; }",
                supported: true,
            })),
            { extension: ".vue", contents: "<template><p>used</p></template>", supported: true },
            { extension: ".svelte", contents: "<p>used</p>", supported: true },
            { extension: ".css", contents: "p { color: red; }", supported: false },
            { extension: ".json", contents: '{"text":"used"}', supported: false },
        ];

        for (const { extension, contents, supported } of originals) {
            it(`should ${supported ? "collect only executed" : "exclude"} ${extension} originals`, async () => {
                const sourceUrl = "http://example.com/components.js";
                const usedCode = "function renderUsed() { return 'used'; }";
                const unusedCode = "function renderUnused() { return 'unused'; }";
                const source = `${usedCode}\n${unusedCode}`;
                const sourceMap = JSON.stringify({
                    version: 3,
                    sources: [`src/Used${extension}`, `src/Unused${extension}`],
                    sourcesContent: [contents, contents.replace("used", "unused")],
                    names: [],
                    mappings: "AAAA;ACAA",
                });

                cdpMock.debugger.getScriptSource.resolves({ scriptSource: source });
                fetchTextWithBrowserFallbackStub.resolves(sourceMap);
                cdpMock.profiler.takePreciseCoverage.resolves({
                    timestamp: 1,
                    result: [
                        {
                            scriptId: "components",
                            url: sourceUrl,
                            functions: [
                                {
                                    functionName: "renderUsed",
                                    isBlockCoverage: false,
                                    ranges: [{ startOffset: 0, endOffset: usedCode.length, count: 1 }],
                                },
                                {
                                    functionName: "renderUnused",
                                    isBlockCoverage: false,
                                    ranges: [{ startOffset: usedCode.length + 1, endOffset: source.length, count: 0 }],
                                },
                            ],
                        },
                    ],
                });

                const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

                await jsSelectivity.start();
                cdpMock.debugger.on
                    .getCall(0)
                    .args[1]({ scriptId: "components", url: sourceUrl, sourceMapURL: "components.js.map" }, sessionId);

                const dependencies = await jsSelectivity.stop();

                assert.deepEqual(
                    Array.from(dependencies || []),
                    supported ? [`${sourceRoot}/src/Used${extension}`] : [],
                );
                assert.notCalled(parseSourceMapRangesStub);
                assert.notCalled(extractSourceFilesDepsStub);
            });
        }
    });

    describe("stop", () => {
        it("should return empty array when drop is true", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            await jsSelectivity.start();
            const result = await jsSelectivity.stop(true);

            assert.deepEqual(Array.from(result || []).sort(), []);
            assert.calledOnce(cdpMock.debugger.off); // Remove scriptParsed event listener only
        });

        it("should process coverage and return dependencies", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            const mockCoverage = {
                timestamp: 100500,
                result: [
                    {
                        scriptId: "script-123",
                        url: "http://example.com/app.js",
                        functions: [
                            {
                                functionName: "foo",
                                isBlockCoverage: false,
                                ranges: [
                                    { startOffset: 0, endOffset: 30, count: 1 },
                                    { startOffset: 100, endOffset: 130, count: 2 },
                                ],
                            },
                        ],
                    },
                ],
            };

            cdpMock.profiler.takePreciseCoverage.resolves(mockCoverage);
            cdpMock.debugger.getScriptSource.resolves({
                scriptSource: "mock source\n//# sourceMappingURL=app.js.map",
            });
            extractSourceFilesDepsStub.returns(new Set(["src/app.js", "src/utils.js"]));

            await jsSelectivity.start();
            const result = await jsSelectivity.stop();

            assert.calledWith(cdpMock.profiler.takePreciseCoverage, sessionId);
            assert.calledWith(
                parseSourceMapRangesStub,
                "mock source\n//# sourceMappingURL=app.js.map",
                "mock source map",
                sourceRoot,
            );
            assert.calledWith(
                extractSourceFilesDepsStub,
                await parseSourceMapRangesStub.returnValues[0],
                mockCoverage.result,
                sinon.match.func,
            );

            assert.deepEqual(Array.from(result || []).sort(), ["src/app.js", "src/utils.js"]);
        });

        it("should handle scripts without URL", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            const mockCoverage = {
                timestamp: 100500,
                result: [
                    {
                        scriptId: "script-123",
                        url: "",
                        functions: [],
                    },
                    {
                        scriptId: "script-456",
                        url: "http://example.com/app.js",
                        functions: [
                            {
                                functionName: "foo",
                                isBlockCoverage: false,
                                ranges: [{ startOffset: 0, endOffset: 30, count: 1 }],
                            },
                        ],
                    },
                ],
            };

            cdpMock.profiler.takePreciseCoverage.resolves(mockCoverage);
            cdpMock.debugger.getScriptSource.resolves({
                scriptSource: "mock source\n//# sourceMappingURL=app.js.map",
            });

            await jsSelectivity.start();
            await jsSelectivity.stop();

            assert.calledOnceWith(
                extractSourceFilesDepsStub,
                await parseSourceMapRangesStub.returnValues[0],
                [mockCoverage.result[1]],
                sinon.match.func,
            );
        });

        it("should not rely on profiler.takePreciseCoverage provided URL", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            const mockCoverage = {
                timestamp: 100500,
                result: [
                    {
                        scriptId: "script-123",
                        url: "", // invalid empty url
                        functions: [
                            {
                                functionName: "foo",
                                isBlockCoverage: false,
                                ranges: [{ startOffset: 0, endOffset: 30, count: 1 }],
                            },
                        ],
                    },
                ],
            };

            cdpMock.profiler.takePreciseCoverage.resolves(mockCoverage);
            cdpMock.debugger.getScriptSource.resolves({
                scriptSource: "mock source\n//# sourceMappingURL=app.js.map",
            });

            await jsSelectivity.start();

            const scriptParsedHandler = cdpMock.debugger.on.getCall(0).args[1];

            const sourceMapURL = "data:application/json;base64,eyJ2ZXJzaW9uIjozfQ==";
            const scriptParsedEvent = {
                scriptId: "script-123",
                url: "http://example.com/app.js", // scriptParsed emitted with valid url
                sourceMapURL: sourceMapURL,
            };

            scriptParsedHandler(scriptParsedEvent, sessionId);

            await jsSelectivity.stop();

            assert.calledWith(cdpMock.debugger.getScriptSource, "test-session-id", "script-123");
            assert.calledOnceWith(hasCachedSelectivityFileStub, CacheType.Asset, "http://example.com/app.js");
            assert.calledOnceWith(getCachedSelectivityFileStub, CacheType.Asset, "http://example.com/app.js");
            assert.neverCalledWith(hasCachedSelectivityFileStub, CacheType.Asset, "");
            assert.neverCalledWith(getCachedSelectivityFileStub, CacheType.Asset, "");
            assert.neverCalledWith(setCachedSelectivityFileStub, CacheType.Asset, "");
        });

        it("should pull sources from from fs-cache", async () => {
            hasCachedSelectivityFileStub.resolves(true);
            getCachedSelectivityFileStub.resolves("source-map");
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            const mockCoverage = {
                timestamp: 100500,
                result: [
                    {
                        scriptId: "script-123",
                        url: "http://example.com/app.js",
                        functions: [
                            {
                                functionName: "foo",
                                isBlockCoverage: false,
                                ranges: [{ startOffset: 0, endOffset: 30, count: 1 }],
                            },
                        ],
                    },
                ],
            };

            const sourceWithSourceMap = `
                console.log("test");
                //# sourceMappingURL=app.js.map
            `;

            cdpMock.profiler.takePreciseCoverage.resolves(mockCoverage);
            cdpMock.debugger.getScriptSource.resolves({ scriptSource: sourceWithSourceMap });

            await jsSelectivity.start();
            await jsSelectivity.stop();

            assert.calledWith(getCachedSelectivityFileStub, CacheType.Asset, "app.js.map");
            assert.neverCalledWith(fetchTextWithBrowserFallbackStub, "app.js.map");
        });

        it("should handle missing scriptParsed events by fetching source manually", async () => {
            hasCachedSelectivityFileStub.resolves(false);
            getCachedSelectivityFileStub.resolves(null);
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            const mockCoverage = {
                timestamp: 100500,
                result: [
                    {
                        scriptId: "script-123",
                        url: "http://example.com/app.js",
                        functions: [
                            {
                                functionName: "foo",
                                isBlockCoverage: false,
                                ranges: [{ startOffset: 0, endOffset: 30, count: 1 }],
                            },
                        ],
                    },
                ],
            };

            const sourceWithSourceMap = `
                console.log("test");
                //# sourceMappingURL=app.js.map
            `;

            cdpMock.profiler.takePreciseCoverage.resolves(mockCoverage);
            cdpMock.debugger.getScriptSource.resolves({ scriptSource: sourceWithSourceMap });

            await jsSelectivity.start();
            await jsSelectivity.stop();

            assert.calledWith(cdpMock.debugger.getScriptSource, sessionId, "script-123");
            assert.calledWith(fetchTextWithBrowserFallbackStub, "app.js.map", cdpMock.runtime, sessionId);
        });

        it("should handle source fetch errors", async () => {
            hasCachedSelectivityFileStub.resolves(false);
            getCachedSelectivityFileStub.resolves(null);
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            const mockCoverage = {
                timestamp: 100500,
                result: [
                    {
                        scriptId: "script-123",
                        url: "http://example.com/app.js",
                        functions: [
                            {
                                functionName: "foo",
                                isBlockCoverage: false,
                                ranges: [{ startOffset: 0, endOffset: 30, count: 1 }],
                            },
                        ],
                    },
                ],
            };

            const sourceError = new Error("Failed to fetch source");
            cdpMock.profiler.takePreciseCoverage.resolves(mockCoverage);
            cdpMock.debugger.getScriptSource.rejects(sourceError);

            await jsSelectivity.start();

            await assert.isRejected(
                jsSelectivity.stop(),
                "JS Selectivity: Couldn't load source code from http://example.com/app.js",
            );
        });

        it("should handle source map fetch errors", async () => {
            hasCachedSelectivityFileStub.resolves(false);
            getCachedSelectivityFileStub.resolves(null);
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot, null);

            const mockCoverage = {
                timestamp: 100500,
                result: [
                    {
                        scriptId: "script-123",
                        url: "http://example.com/app.js",
                        functions: [
                            {
                                functionName: "foo",
                                isBlockCoverage: false,
                                ranges: [{ startOffset: 0, endOffset: 30, count: 1 }],
                            },
                        ],
                    },
                ],
            };

            const sourceWithSourceMap = `
                console.log("test");
                //# sourceMappingURL=app.js.map
            `;

            const sourceMapError = new Error("Failed to fetch source map");
            cdpMock.profiler.takePreciseCoverage.resolves(mockCoverage);
            cdpMock.debugger.getScriptSource.resolves({ scriptSource: sourceWithSourceMap });
            fetchTextWithBrowserFallbackStub.rejects(sourceMapError);

            await jsSelectivity.start();

            await assert.isRejected(jsSelectivity.stop(), "JS Selectivity: Couldn't load source maps from app.js.map");
        });
    });

    describe("mapSourceMapUrl", () => {
        describe("scriptParsed event", () => {
            it("should skip script when mapSourceMapUrl returns falsy", async () => {
                const mapSourceMapUrl = sinon.stub().returns(false);
                const jsSelectivity = new JSSelectivity(
                    cdpMock as unknown as CDP,
                    sessionId,
                    sourceRoot,
                    mapSourceMapUrl,
                );

                await jsSelectivity.start();

                const scriptParsedHandler = cdpMock.debugger.on.getCall(0).args[1];
                scriptParsedHandler(
                    { scriptId: "script-123", url: "http://example.com/app.js", sourceMapURL: "app.js.map" },
                    sessionId,
                );

                assert.calledOnceWith(mapSourceMapUrl, {
                    type: "js",
                    sourceUrl: "http://example.com/app.js",
                    sourceMapUrl: "app.js.map",
                });
                assert.notCalled(cdpMock.debugger.getScriptSource);
                assert.notCalled(fetchTextWithBrowserFallbackStub);
            });

            it("should mark script as processed when filtered so 'getScriptSource' will not be called", async () => {
                const mapSourceMapUrl = sinon.stub().returns(false);
                const jsSelectivity = new JSSelectivity(
                    cdpMock as unknown as CDP,
                    sessionId,
                    sourceRoot,
                    mapSourceMapUrl,
                );

                await jsSelectivity.start();

                const scriptParsedHandler = cdpMock.debugger.on.getCall(0).args[1];
                scriptParsedHandler(
                    { scriptId: "script-123", url: "http://example.com/app.js", sourceMapURL: "app.js.map" },
                    sessionId,
                );

                // Coverage refers to the same script that was filtered
                cdpMock.profiler.takePreciseCoverage.resolves({
                    timestamp: 100500,
                    result: [
                        {
                            scriptId: "script-123",
                            url: "http://example.com/app.js",
                            functions: [
                                {
                                    functionName: "foo",
                                    isBlockCoverage: false,
                                    ranges: [{ startOffset: 0, endOffset: 30, count: 1 }],
                                },
                            ],
                        },
                    ],
                });

                await jsSelectivity.takeCoverageSnapshot();

                assert.notCalled(cdpMock.debugger.getScriptSource);
            });

            it("should replace source map URL when mapSourceMapUrl returns a string", async () => {
                const mapSourceMapUrl = sinon.stub().returns("http://cdn.example.com/remapped-app.js.map");
                const jsSelectivity = new JSSelectivity(
                    cdpMock as unknown as CDP,
                    sessionId,
                    sourceRoot,
                    mapSourceMapUrl,
                );

                const hasCachedSelectivityFileStubResult = Promise.resolve(false);
                const fetchTextWithBrowserFallbackStubResult = Promise.resolve("source map");
                hasCachedSelectivityFileStub.returns(hasCachedSelectivityFileStubResult);
                fetchTextWithBrowserFallbackStub.returns(fetchTextWithBrowserFallbackStubResult);

                await jsSelectivity.start();

                const scriptParsedHandler = cdpMock.debugger.on.getCall(0).args[1];
                scriptParsedHandler(
                    { scriptId: "script-123", url: "http://example.com/app.js", sourceMapURL: "app.js.map" },
                    sessionId,
                );

                await hasCachedSelectivityFileStubResult;
                await fetchTextWithBrowserFallbackStubResult;

                assert.calledWith(
                    fetchTextWithBrowserFallbackStub,
                    "http://cdn.example.com/remapped-app.js.map",
                    cdpMock.runtime,
                    sessionId,
                );
            });

            it("should pass through when mapSourceMapUrl returns true", async () => {
                const mapSourceMapUrl = sinon.stub().returns(true);
                const jsSelectivity = new JSSelectivity(
                    cdpMock as unknown as CDP,
                    sessionId,
                    sourceRoot,
                    mapSourceMapUrl,
                );

                const hasCachedSelectivityFileStubResult = Promise.resolve(false);
                const fetchTextWithBrowserFallbackStubResult = Promise.resolve("source map");
                hasCachedSelectivityFileStub.returns(hasCachedSelectivityFileStubResult);
                fetchTextWithBrowserFallbackStub.returns(fetchTextWithBrowserFallbackStubResult);

                await jsSelectivity.start();

                const scriptParsedHandler = cdpMock.debugger.on.getCall(0).args[1];
                scriptParsedHandler(
                    { scriptId: "script-123", url: "http://example.com/app.js", sourceMapURL: "app.js.map" },
                    sessionId,
                );

                await hasCachedSelectivityFileStubResult;
                await fetchTextWithBrowserFallbackStubResult;

                // Should use the original resolved URL (urlResolveStub returns second arg)
                assert.calledWith(fetchTextWithBrowserFallbackStub, "app.js.map", cdpMock.runtime, sessionId);
            });
        });

        describe("coverage fallback", () => {
            it("should skip script in fallback when mapSourceMapUrl returns falsy", async () => {
                const mapSourceMapUrl = sinon.stub().returns(false);
                const jsSelectivity = new JSSelectivity(
                    cdpMock as unknown as CDP,
                    sessionId,
                    sourceRoot,
                    mapSourceMapUrl,
                );

                const sourceWithSourceMap = `console.log("test");\n//# sourceMappingURL=app.js.map`;

                cdpMock.profiler.takePreciseCoverage.resolves({
                    timestamp: 100500,
                    result: [
                        {
                            scriptId: "script-999",
                            url: "http://example.com/app.js",
                            functions: [
                                {
                                    functionName: "foo",
                                    isBlockCoverage: false,
                                    ranges: [{ startOffset: 0, endOffset: 30, count: 1 }],
                                },
                            ],
                        },
                    ],
                });
                hasCachedSelectivityFileStub.resolves(false);
                getCachedSelectivityFileStub.resolves(null);
                cdpMock.debugger.getScriptSource.resolves({ scriptSource: sourceWithSourceMap });

                await jsSelectivity.start();
                const result = await jsSelectivity.stop();

                assert.deepEqual(Array.from(result || []), []);
            });

            it("should replace source map URL in fallback when mapSourceMapUrl returns a string", async () => {
                const mapSourceMapUrl = sinon.stub().returns("http://cdn.example.com/remapped.js.map");
                const jsSelectivity = new JSSelectivity(
                    cdpMock as unknown as CDP,
                    sessionId,
                    sourceRoot,
                    mapSourceMapUrl,
                );

                const sourceWithSourceMap = `console.log("test");\n//# sourceMappingURL=app.js.map`;

                cdpMock.profiler.takePreciseCoverage.resolves({
                    timestamp: 100500,
                    result: [
                        {
                            scriptId: "script-999",
                            url: "http://example.com/app.js",
                            functions: [
                                {
                                    functionName: "foo",
                                    isBlockCoverage: false,
                                    ranges: [{ startOffset: 0, endOffset: 30, count: 1 }],
                                },
                            ],
                        },
                    ],
                });
                hasCachedSelectivityFileStub.resolves(false);
                getCachedSelectivityFileStub.resolves(null);
                cdpMock.debugger.getScriptSource.resolves({ scriptSource: sourceWithSourceMap });
                extractSourceFilesDepsStub.returns(new Set(["src/app.js"]));

                await jsSelectivity.start();
                await jsSelectivity.stop();

                assert.calledWith(
                    fetchTextWithBrowserFallbackStub,
                    "http://cdn.example.com/remapped.js.map",
                    cdpMock.runtime,
                    sessionId,
                );
            });

            it("should recalculate source map when url is corrected and mapSourceMapUrl is set", async () => {
                const mapSourceMapUrl = sinon.stub().returns(true);
                const jsSelectivity = new JSSelectivity(
                    cdpMock as unknown as CDP,
                    sessionId,
                    sourceRoot,
                    mapSourceMapUrl,
                );

                const sourceWithSourceMap = `console.log("test");\n//# sourceMappingURL=app.js.map`;

                await jsSelectivity.start();

                const scriptParsedHandler = cdpMock.debugger.on.getCall(0).args[1];

                scriptParsedHandler(
                    { scriptId: "script-123", url: "", sourceMapURL: "" }, // Anonymous, no url specified
                    sessionId,
                );

                // Coverage with a corrected URL
                cdpMock.profiler.takePreciseCoverage.resolves({
                    timestamp: 100500,
                    result: [
                        {
                            scriptId: "script-123",
                            url: "http://example.com/app.js",
                            functions: [
                                {
                                    functionName: "foo",
                                    isBlockCoverage: false,
                                    ranges: [{ startOffset: 0, endOffset: 30, count: 1 }],
                                },
                            ],
                        },
                    ],
                });
                hasCachedSelectivityFileStub.resolves(false);
                getCachedSelectivityFileStub.resolves(null);
                cdpMock.debugger.getScriptSource.resolves({ scriptSource: sourceWithSourceMap });
                extractSourceFilesDepsStub.returns(new Set(["src/app.js"]));

                await jsSelectivity.stop();

                assert.calledWith(
                    mapSourceMapUrl,
                    sinon.match({
                        type: "js",
                        sourceUrl: "http://example.com/app.js",
                    }),
                );
            });
        });
    });
});
