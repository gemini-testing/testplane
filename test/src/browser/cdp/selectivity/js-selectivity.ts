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
        extractSourceFilesDepsStub = sandbox.stub().resolves(new Set(["src/app.js", "src/utils.js"]));
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

        JSSelectivity = proxyquire("src/browser/cdp/selectivity/js-selectivity", {
            lodash: { groupBy: groupByStub },
            "node:url": { resolve: urlResolveStub },
            "./utils": {
                extractSourceFilesDeps: extractSourceFilesDepsStub,
                fetchTextWithBrowserFallback: fetchTextWithBrowserFallbackStub,
            },
        }).JSSelectivity;
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("constructor", () => {
        it("should initialize with correct parameters", () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot);

            assert.isOk(jsSelectivity);
        });

        it("should initialize with default sourceRoot", () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId);

            assert.isOk(jsSelectivity);
        });
    });

    describe("start", () => {
        it("should set up CDP connections and start coverage", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot);

            await jsSelectivity.start();

            assert.calledWith(cdpMock.target.setAutoAttach, sessionId, {
                autoAttach: true,
                waitForDebuggerOnStart: false,
            });
            assert.calledWith(cdpMock.debugger.enable, sessionId);
            assert.calledWith(cdpMock.profiler.enable, sessionId);
            assert.calledWith(cdpMock.profiler.startPreciseCoverage, sessionId, {
                callCount: false,
                detailed: false,
                allowTriggeredUpdates: false,
            });
            assert.calledTwice(cdpMock.debugger.on); // paused and scriptParsed events
        });

        it("should handle debugger paused events", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot);

            await jsSelectivity.start();

            const pausedHandler = cdpMock.debugger.on.getCall(0).args[1];

            await pausedHandler({});

            assert.calledWith(cdpMock.debugger.resume, sessionId);
        });

        it("should handle scriptParsed events", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot);

            await jsSelectivity.start();

            const scriptParsedHandler = cdpMock.debugger.on.getCall(1).args[1];

            const scriptParsedEvent = {
                scriptId: "script-123",
                url: "http://example.com/app.js",
                sourceMapURL: "app.js.map",
            };

            scriptParsedHandler(scriptParsedEvent);

            assert.calledWith(cdpMock.debugger.getScriptSource, sessionId, "script-123");
            assert.calledWith(fetchTextWithBrowserFallbackStub, "app.js.map", cdpMock.runtime, sessionId);
        });

        it("should handle scriptParsed events without URL or sourceMapURL", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot);

            await jsSelectivity.start();

            const scriptParsedHandler = cdpMock.debugger.on.getCall(1).args[1];

            const scriptParsedEvent = {
                scriptId: "script-123",
                url: "",
                sourceMapURL: "",
            };

            scriptParsedHandler(scriptParsedEvent);

            assert.notCalled(cdpMock.debugger.getScriptSource);
            assert.notCalled(fetchTextWithBrowserFallbackStub);
        });
    });

    describe("stop", () => {
        it("should return empty array when drop is true", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot);

            await jsSelectivity.start();
            const result = await jsSelectivity.stop(true);

            assert.deepEqual(result, []);
            assert.calledTwice(cdpMock.debugger.off); // Remove both event listeners
        });

        it("should process coverage and return dependencies", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot);

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
            extractSourceFilesDepsStub.resolves(new Set(["src/app.js", "src/utils.js", "src/styles.css"]));

            await jsSelectivity.start();
            const result = await jsSelectivity.stop();

            assert.calledWith(cdpMock.profiler.takePreciseCoverage, sessionId);
            assert.calledWith(
                extractSourceFilesDepsStub,
                "mock source\n//# sourceMappingURL=app.js.map",
                "mock source map",
                [0, 100],
                sourceRoot,
            );

            assert.deepEqual(result, ["src/app.js", "src/utils.js"]);
        });

        it("should handle scripts without URL", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot);

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

            assert.calledOnce(extractSourceFilesDepsStub);
        });

        it("should handle missing scriptParsed events by fetching source manually", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot);

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

        it("should handle source code without source map comment", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot);

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

            const sourceWithoutSourceMap = "console.log('test');";

            cdpMock.profiler.takePreciseCoverage.resolves(mockCoverage);
            cdpMock.debugger.getScriptSource.resolves({ scriptSource: sourceWithoutSourceMap });

            await jsSelectivity.start();

            await assert.isRejected(
                jsSelectivity.stop(),
                /JS Selectivity: Couldn't load source maps of.*Source maping url comment is missing/,
            );
        });

        it("should handle source fetch errors", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot);

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
                /JS Selectivity: Couldn't load source code at.*Failed to fetch source/,
            );
        });

        it("should handle source map fetch errors", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot);

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
            fetchTextWithBrowserFallbackStub.resolves(sourceMapError);

            await jsSelectivity.start();

            await assert.isRejected(
                jsSelectivity.stop(),
                /JS Selectivity: Couldn't load source maps of.*Failed to fetch source map/,
            );
        });

        it("should filter out non-source-code files", async () => {
            const jsSelectivity = new JSSelectivity(cdpMock as unknown as CDP, sessionId, sourceRoot);

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

            extractSourceFilesDepsStub.resolves(
                new Set([
                    "src/app.js",
                    "src/utils.ts",
                    "src/component.jsx",
                    "src/styles.css",
                    "src/image.png",
                    "src/data.json",
                    "src/module.mjs",
                    "src/config.cjs",
                ]),
            );

            cdpMock.profiler.takePreciseCoverage.resolves(mockCoverage);
            cdpMock.debugger.getScriptSource.resolves({
                scriptSource: "mock source\n//# sourceMappingURL=app.js.map",
            });

            await jsSelectivity.start();
            const result = await jsSelectivity.stop();

            assert.deepEqual(result, [
                "src/app.js",
                "src/component.jsx",
                "src/config.cjs",
                "src/module.mjs",
                "src/utils.ts",
            ]);
        });
    });
});
