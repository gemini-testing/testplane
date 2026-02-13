import sinon, { SinonStub } from "sinon";
import proxyquire from "proxyquire";

describe("CDP/Selectivity/CSSSelectivity", () => {
    const sandbox = sinon.createSandbox();
    let CSSSelectivity: typeof import("src/browser/cdp/selectivity/css-selectivity").CSSSelectivity;
    let cdpMock: {
        target: { setAutoAttach: SinonStub };
        dom: { enable: SinonStub };
        css: {
            enable: SinonStub;
            startRuleUsageTracking: SinonStub;
            stopRuleUsageTracking: SinonStub;
            getStyleSheetText: SinonStub;
            on: SinonStub;
            off: SinonStub;
        };
        runtime: any;
    };
    let fetchTextWithBrowserFallbackStub: SinonStub;
    let patchSourceMapSourcesStub: SinonStub;
    let urlResolveStub: SinonStub;
    let groupByStub: SinonStub;
    let pathStub: { posix: { join: SinonStub } };
    let hasProtocolStub: SinonStub;
    let isDataProtocolStub: SinonStub;

    const CacheType = { Asset: "a" };

    let getCachedSelectivityFileStub: SinonStub;
    let hasCachedSelectivityFileStub: SinonStub;
    let setCachedSelectivityFileStub: SinonStub;

    const sessionId = "test-session-id";
    const sourceRoot = "/test/source-root";
    const styleSheetEvent = {
        header: {
            styleSheetId: "stylesheet-123",
            frameId: "frame-123",
            sourceURL: "http://example.com/styles.css",
            sourceMapURL: "styles.css.map",
            origin: "regular" as const,
            title: "styles.css",
            disabled: false,
            isInline: false,
            isMutable: false,
            isConstructed: false,
            startLine: 0,
            startColumn: 0,
            length: 100,
            endLine: 10,
            endColumn: 0,
        },
    };
    const mockSourceMap = {
        version: 3,
        sources: ["src/styles.css", "src/theme.css"],
        sourceRoot: "/root",
        names: [],
        mappings: "",
        file: "styles.css",
    };

    beforeEach(() => {
        cdpMock = {
            target: { setAutoAttach: sandbox.stub().resolves() },
            dom: { enable: sandbox.stub().resolves() },
            css: {
                enable: sandbox.stub().resolves(),
                startRuleUsageTracking: sandbox.stub().resolves(),
                stopRuleUsageTracking: sandbox.stub().resolves({
                    ruleUsage: [{ styleSheetId: "stylesheet-123", startOffset: 0, endOffset: 100, used: true }],
                }),
                getStyleSheetText: sandbox.stub().resolves({ text: "mock css" }),
                on: sandbox.stub(),
                off: sandbox.stub(),
            },
            runtime: {},
        };

        fetchTextWithBrowserFallbackStub = sandbox.stub().resolves(JSON.stringify(mockSourceMap));
        patchSourceMapSourcesStub = sandbox.stub().returnsArg(0);
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
        pathStub = {
            posix: { join: sandbox.stub().callsFake((...args) => args.join("/")) },
        };
        hasProtocolStub = sandbox.stub().returns(false);
        isDataProtocolStub = sandbox.stub().callsFake((url: string) => url.startsWith("data:"));

        getCachedSelectivityFileStub = sandbox.stub().resolves(JSON.stringify(mockSourceMap));
        hasCachedSelectivityFileStub = sandbox.stub().resolves(false);
        setCachedSelectivityFileStub = sandbox.stub().resolves();

        CSSSelectivity = proxyquire("src/browser/cdp/selectivity/css-selectivity", {
            lodash: { groupBy: groupByStub },
            path: pathStub,
            "node:url": { resolve: urlResolveStub, URL: global.URL },
            "./utils": {
                fetchTextWithBrowserFallback: fetchTextWithBrowserFallbackStub,
                patchSourceMapSources: patchSourceMapSourcesStub,
                hasProtocol: hasProtocolStub,
                isDataProtocol: isDataProtocolStub,
            },
            "./fs-cache": {
                CacheType,
                getCachedSelectivityFile: getCachedSelectivityFileStub,
                hasCachedSelectivityFile: hasCachedSelectivityFileStub,
                setCachedSelectivityFile: setCachedSelectivityFileStub,
            },
        }).CSSSelectivity;
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("constructor", () => {
        it("should initialize with correct parameters", () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, sourceRoot);

            assert.isOk(cssSelectivity);
        });

        it("should initialize with default sourceRoot", () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId);

            assert.isOk(cssSelectivity);
        });
    });

    describe("start", () => {
        it("should set up CDP connections and start rule usage tracking", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, sourceRoot);

            await cssSelectivity.start();

            assert.calledWith(cdpMock.target.setAutoAttach, sessionId, {
                autoAttach: true,
                waitForDebuggerOnStart: false,
            });
            assert.calledWith(cdpMock.dom.enable, sessionId);
            assert.calledWith(cdpMock.css.enable, sessionId);
            assert.calledWith(cdpMock.css.startRuleUsageTracking, sessionId);
            assert.calledOnceWith(cdpMock.css.on, "styleSheetAdded");
        });

        it("should handle styleSheetAdded events when there is no cache", async () => {
            const hasCachedSelectivityFileStubResult = Promise.resolve(false);
            const fetchTextWithBrowserFallbackStubResult = Promise.resolve("src");
            hasCachedSelectivityFileStub.returns(hasCachedSelectivityFileStubResult);
            fetchTextWithBrowserFallbackStub.returns(fetchTextWithBrowserFallbackStubResult);
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, sourceRoot);

            await cssSelectivity.start();

            const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];

            styleSheetAddedHandler(styleSheetEvent);

            await hasCachedSelectivityFileStubResult;
            await fetchTextWithBrowserFallbackStubResult;

            assert.calledWith(fetchTextWithBrowserFallbackStub, "styles.css.map", cdpMock.runtime, sessionId);
            assert.calledWith(setCachedSelectivityFileStub, CacheType.Asset, "styles.css.map", "src");
        });

        it("should handle styleSheetAdded events when there is is cache", async () => {
            const hasCachedSelectivityFileStubResult = Promise.resolve(true);
            hasCachedSelectivityFileStub.returns(hasCachedSelectivityFileStubResult);
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, sourceRoot);

            await cssSelectivity.start();

            const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];

            styleSheetAddedHandler(styleSheetEvent);

            await hasCachedSelectivityFileStubResult;

            assert.neverCalledWith(fetchTextWithBrowserFallbackStub, "styles.css.map");
        });

        it("should handle styleSheetAdded events for data urls", async () => {
            const sourceMapURL = "data:text/plain;base64,SGVsbG8sIFdvcmxkIQ%3D%3D";
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, sourceRoot);

            await cssSelectivity.start();

            const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];

            styleSheetAddedHandler({ ...styleSheetEvent, header: { ...styleSheetEvent.header, sourceMapURL } });

            assert.neverCalledWith(hasCachedSelectivityFileStub, CacheType.Asset, sourceMapURL);
            assert.neverCalledWith(getCachedSelectivityFileStub, CacheType.Asset, sourceMapURL);
            assert.calledWith(fetchTextWithBrowserFallbackStub, sourceMapURL);
        });

        it("should handle styleSheetAdded events without sourceURL or sourceMapURL", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, sourceRoot);

            await cssSelectivity.start();

            const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];

            const styleSheetEvent = {
                header: {
                    styleSheetId: "stylesheet-123",
                    frameId: "frame-123",
                    sourceURL: "",
                    sourceMapURL: "",
                    origin: "regular" as const,
                    title: "styles.css",
                    disabled: false,
                    isInline: false,
                    isMutable: false,
                    isConstructed: false,
                    startLine: 0,
                    startColumn: 0,
                    length: 100,
                    endLine: 10,
                    endColumn: 0,
                },
            };

            styleSheetAddedHandler(styleSheetEvent);

            assert.notCalled(fetchTextWithBrowserFallbackStub);
        });

        it("should not process events if sessionId is not set", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, "", sourceRoot);

            await cssSelectivity.start();

            const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];

            const styleSheetEvent = {
                header: {
                    styleSheetId: "stylesheet-123",
                    frameId: "frame-123",
                    sourceURL: "http://example.com/styles.css",
                    sourceMapURL: "styles.css.map",
                    origin: "regular" as const,
                    title: "styles.css",
                    disabled: false,
                    isInline: false,
                    isMutable: false,
                    isConstructed: false,
                    startLine: 0,
                    startColumn: 0,
                    length: 100,
                    endLine: 10,
                    endColumn: 0,
                },
            };

            styleSheetAddedHandler(styleSheetEvent);

            assert.notCalled(fetchTextWithBrowserFallbackStub);
        });
    });

    describe("stop", () => {
        it("should return empty array when drop is true", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, sourceRoot);

            await cssSelectivity.start();
            const result = await cssSelectivity.stop(true);

            assert.deepEqual(Array.from(result || []).sort(), []);
            assert.calledOnceWith(cdpMock.css.off, "styleSheetAdded");
        });

        it("should process rule usage and return dependencies", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, sourceRoot);

            const mockRuleUsage = {
                ruleUsage: [{ styleSheetId: "stylesheet-123", startOffset: 0, endOffset: 100, used: true }],
            };

            const mockSourceMap = {
                version: 3,
                sources: ["src/styles.css", "src/theme.css"],
                sourceRoot: "/root",
                names: [],
                mappings: "",
                file: "styles.css",
            };

            cdpMock.css.stopRuleUsageTracking.resolves(mockRuleUsage);
            getCachedSelectivityFileStub.resolves(JSON.stringify(mockSourceMap));
            patchSourceMapSourcesStub.returns(mockSourceMap);

            await cssSelectivity.start();
            const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];

            styleSheetAddedHandler({
                header: {
                    styleSheetId: "stylesheet-123",
                    frameId: "frame-123",
                    sourceURL: "http://example.com/styles.css",
                    sourceMapURL: "styles.css.map",
                    origin: "regular" as const,
                    title: "styles.css",
                    disabled: false,
                    isInline: false,
                    isMutable: false,
                    isConstructed: false,
                    startLine: 0,
                    startColumn: 0,
                    length: 100,
                    endLine: 10,
                    endColumn: 0,
                },
            });

            const result = await cssSelectivity.stop();

            assert.calledWith(cdpMock.css.stopRuleUsageTracking, sessionId);
            assert.calledWith(
                patchSourceMapSourcesStub,
                {
                    version: 3,
                    sources: ["src/styles.css", "src/theme.css"],
                    sourceRoot: "/root",
                    names: [],
                    mappings: "",
                    file: "styles.css",
                },
                sourceRoot,
            );

            assert.deepEqual(Array.from(result || []).sort(), ["/root/src/styles.css", "/root/src/theme.css"]);
        });

        it("should handle missing styleSheetAdded events by fetching manually", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, sourceRoot);

            const mockRuleUsage = {
                ruleUsage: [{ styleSheetId: "stylesheet-123", startOffset: 0, endOffset: 100, used: true }],
            };

            const cssWithSourceMap = `.test { color: red; }
/*# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozfQ==*/`;

            const mockSourceMap = {
                sources: ["src/styles.css"],
                sourceRoot: "/root",
            };

            cdpMock.css.stopRuleUsageTracking.resolves(mockRuleUsage);
            cdpMock.css.getStyleSheetText.resolves({ text: cssWithSourceMap });
            patchSourceMapSourcesStub.returns(mockSourceMap);

            await cssSelectivity.start();
            await cssSelectivity.stop();

            assert.calledWith(cdpMock.css.getStyleSheetText, sessionId, "stylesheet-123");
            assert.calledWith(
                fetchTextWithBrowserFallbackStub,
                "data:application/json;base64,eyJ2ZXJzaW9uIjozfQ==",
                cdpMock.runtime,
                sessionId,
            );
        });

        it("should handle cached styleSheet source maps", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, sourceRoot);

            const mockRuleUsage = {
                ruleUsage: [{ styleSheetId: "stylesheet-123", startOffset: 0, endOffset: 100, used: true }],
            };

            const mockSourceMap = {
                sources: ["src/styles.css"],
                sourceRoot: "/root",
            };

            hasCachedSelectivityFileStub.resolves(true);
            getCachedSelectivityFileStub.resolves(JSON.stringify(mockSourceMap));
            cdpMock.css.stopRuleUsageTracking.resolves(mockRuleUsage);
            patchSourceMapSourcesStub.returns(mockSourceMap);

            await cssSelectivity.start();

            const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];
            styleSheetAddedHandler(styleSheetEvent);

            await cssSelectivity.stop();

            assert.calledOnceWith(getCachedSelectivityFileStub, CacheType.Asset, "styles.css.map");
            assert.neverCalledWith(fetchTextWithBrowserFallbackStub, "styles.css.map");
        });

        it("should handle cache write fail for styleSheet source maps", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, sourceRoot);

            const mockRuleUsage = {
                ruleUsage: [{ styleSheetId: "stylesheet-123", startOffset: 0, endOffset: 100, used: true }],
            };

            const mockSourceMap = {
                sources: ["src/styles.css"],
                sourceRoot: "/root",
            };

            hasCachedSelectivityFileStub.resolves(false);
            getCachedSelectivityFileStub.resolves(JSON.stringify(mockSourceMap));
            setCachedSelectivityFileStub.rejects(new Error("can't write cache file"));
            cdpMock.css.stopRuleUsageTracking.resolves(mockRuleUsage);
            patchSourceMapSourcesStub.returns(mockSourceMap);

            await cssSelectivity.start();

            const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];
            styleSheetAddedHandler(styleSheetEvent);

            const result = await cssSelectivity.stop();

            assert.calledOnceWith(fetchTextWithBrowserFallbackStub, "styles.css.map");
            assert.neverCalledWith(getCachedSelectivityFileStub, CacheType.Asset, "styles.css.map");
            assert.deepEqual(Array.from(result ? result : []), ["/root/src/styles.css"]);
        });

        it("should handle non-embedded source maps without stylesheet URL", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, sourceRoot);

            const mockRuleUsage = {
                ruleUsage: [{ styleSheetId: "stylesheet-123", startOffset: 0, endOffset: 100, used: true }],
            };

            const cssWithExternalSourceMap = `.test { color: red; }
/*# sourceMappingURL=http://example.com/styles.css.map*/`;

            cdpMock.css.stopRuleUsageTracking.resolves(mockRuleUsage);
            cdpMock.css.getStyleSheetText.resolves({ text: cssWithExternalSourceMap });

            await cssSelectivity.start();

            const error: Error & { cause: Error } = await cssSelectivity.stop().catch(err => err);

            assert.match(error.cause.message, /Missed stylesheet url for stylesheet id stylesheet-123/);
        });

        it("should handle stylesheet text fetch errors", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, sourceRoot);

            const mockRuleUsage = {
                ruleUsage: [{ styleSheetId: "stylesheet-123", startOffset: 0, endOffset: 100, used: true }],
            };

            const fetchError = new Error("Failed to fetch stylesheet");
            cdpMock.css.stopRuleUsageTracking.resolves(mockRuleUsage);
            cdpMock.css.getStyleSheetText.rejects(fetchError);

            await cssSelectivity.start();

            const error: Error & { cause: Error } = await cssSelectivity.stop().catch(err => err);

            assert.match(error.cause.message, /Failed to fetch stylesheet/);
        });

        it("should handle source map fetch errors", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, sourceRoot);

            const mockRuleUsage = {
                ruleUsage: [{ styleSheetId: "stylesheet-123", startOffset: 0, endOffset: 100, used: true }],
            };

            const sourceMapError = new Error("Failed to fetch source map");
            cdpMock.css.stopRuleUsageTracking.resolves(mockRuleUsage);
            fetchTextWithBrowserFallbackStub.rejects(sourceMapError);

            await cssSelectivity.start();
            const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];

            styleSheetAddedHandler({
                header: {
                    styleSheetId: "stylesheet-123",
                    frameId: "frame-123",
                    sourceURL: "http://example.com/styles.css",
                    sourceMapURL: "styles.css.map",
                    origin: "regular" as const,
                    title: "styles.css",
                    disabled: false,
                    isInline: false,
                    isMutable: false,
                    isConstructed: false,
                    startLine: 0,
                    startColumn: 0,
                    length: 100,
                    endLine: 10,
                    endColumn: 0,
                },
            });

            const error: Error & { cause: Error } = await cssSelectivity.stop().catch(err => err);

            assert.match(error.cause.message, /Failed to fetch source map/);
        });

        it("should handle files with protocols", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, sourceRoot);

            const mockRuleUsage = {
                ruleUsage: [{ styleSheetId: "stylesheet-123" }],
            };

            const mockSourceMap = {
                sources: ["file:///absolute/path/styles.css", "src/relative.css"],
                sourceRoot: "/root",
            };

            hasProtocolStub.callsFake((path: string) => path.startsWith("file://"));
            cdpMock.css.stopRuleUsageTracking.resolves(mockRuleUsage);
            patchSourceMapSourcesStub.returns(mockSourceMap);

            await cssSelectivity.start();
            const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];

            styleSheetAddedHandler({
                header: {
                    styleSheetId: "stylesheet-123",
                    sourceURL: "http://example.com/styles.css",
                    sourceMapURL: "styles.css.map",
                },
            });

            const result = await cssSelectivity.stop();

            assert.deepEqual(Array.from(result || []).sort(), [
                "/root/src/relative.css",
                "file:///absolute/path/styles.css",
            ]);
        });

        it("should return sorted and unique dependencies", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, sourceRoot);

            const mockRuleUsage = {
                ruleUsage: [{ styleSheetId: "stylesheet-123" }, { styleSheetId: "stylesheet-456" }],
            };

            const mockSourceMap1 = {
                sources: ["src/z-styles.css", "src/a-styles.css"],
                sourceRoot: "/root",
            };

            const mockSourceMap2 = {
                sources: ["src/b-styles.css", "src/a-styles.css"],
                sourceRoot: "/root",
            };

            cdpMock.css.stopRuleUsageTracking.resolves(mockRuleUsage);
            patchSourceMapSourcesStub.onFirstCall().returns(mockSourceMap1).onSecondCall().returns(mockSourceMap2);

            await cssSelectivity.start();
            const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];

            styleSheetAddedHandler({
                header: {
                    styleSheetId: "stylesheet-123",
                    sourceURL: "http://example.com/styles1.css",
                    sourceMapURL: "styles1.css.map",
                },
            });

            styleSheetAddedHandler({
                header: {
                    styleSheetId: "stylesheet-456",
                    sourceURL: "http://example.com/styles2.css",
                    sourceMapURL: "styles2.css.map",
                },
            });

            const result = await cssSelectivity.stop();

            assert.deepEqual(Array.from(result || []).sort(), [
                "/root/src/a-styles.css",
                "/root/src/b-styles.css",
                "/root/src/z-styles.css",
            ]);
        });
    });
});
