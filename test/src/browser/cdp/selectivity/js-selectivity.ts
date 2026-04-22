import sinon, { SinonStub, type SinonStubbedInstance } from "sinon";
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
                takePreciseCoverage: sandbox.stub().resolves({ result: [] }),
            } as SinonStubbedInstance<CDPProfiler>,
            runtime: {} as SinonStubbedInstance<CDPRuntime>,
        };

        fetchTextWithBrowserFallbackStub = sandbox.stub().resolves("mock source map");
        extractSourceFilesDepsStub = sandbox.stub().returns(new Set(["src/app.js", "src/utils.js"]));
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
                extractSourceFilesDepsStub,
                "mock source\n//# sourceMappingURL=app.js.map",
                "mock source map",
                mockCoverage.result,
                sourceRoot,
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
                "mock source\n//# sourceMappingURL=app.js.map",
                "mock source map",
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
