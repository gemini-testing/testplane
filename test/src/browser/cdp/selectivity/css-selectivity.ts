import sinon, { type SinonStub } from "sinon";
import proxyquire from "proxyquire";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { EventEmitter } from "node:events";
import { pathToFileURL, resolve as urlResolve } from "node:url";
import { TraceMap } from "@jridgewell/trace-mapping";
import { hasProtocol, patchSourceMapSources, transformSourceDependencies } from "src/browser/cdp/selectivity/utils";
import { CSSSelectivity as ProductionCSSSelectivity } from "src/browser/cdp/selectivity/css-selectivity";

describe("CDP/Selectivity/CSSSelectivity source-root compatibility", () => {
    let project: string;
    let original: string;
    let sequence = 0;

    beforeEach(() => {
        project = fs.mkdtempSync(path.join(os.tmpdir(), "testplane-css-roots-"));
        original = path.join(project, "src/theme.css");
        fs.mkdirSync(path.dirname(original), { recursive: true });
        fs.writeFileSync(original, ".theme { color: red }");
    });

    afterEach(() => {
        fs.rmSync(project, { recursive: true, force: true });
    });

    const relative = (file: string): string => path.posix.relative(process.cwd(), file);

    const collect = async ({
        sources,
        configuredRoot = "",
        mapRoot = "",
        used = true,
        lostEvent = false,
        snapshot = false,
    }: {
        sources: string[];
        configuredRoot?: string;
        mapRoot?: string;
        used?: boolean;
        lostEvent?: boolean;
        snapshot?: boolean;
    }): Promise<Set<string>> => {
        const sourceMap = {
            version: 3,
            sources,
            sourceRoot: mapRoot,
            sourcesContent: sources.map(() => fs.readFileSync(original, "utf8")),
            names: [],
            mappings: "AAAA",
        };
        const sourceMapURL = `data:application/json;base64,${Buffer.from(JSON.stringify(sourceMap)).toString(
            "base64",
        )}`;
        const emitter = new EventEmitter();
        const sessionId = `css-roots-${process.pid}-${sequence++}`;
        const styleSheetId = "stylesheet";
        const ruleUsage = [{ styleSheetId, startOffset: 0, endOffset: 100, used }];
        const cdp = {
            css: {
                on: emitter.on.bind(emitter),
                off: emitter.off.bind(emitter),
                startRuleUsageTracking: async () => ({}),
                stopRuleUsageTracking: async () => ({ ruleUsage: snapshot ? [] : ruleUsage }),
                takeCoverageDelta: async () => ({ coverage: ruleUsage }),
                getStyleSheetText: async () => ({
                    text: `.theme { color: red }\n/*# sourceMappingURL=${sourceMapURL} */`,
                }),
            },
            runtime: {},
        };
        const collector = new ProductionCSSSelectivity(cdp as any, sessionId, sessionId, configuredRoot, null);

        await collector.start();
        if (!lostEvent) {
            emitter.emit(
                "styleSheetAdded",
                { header: { styleSheetId, sourceURL: "http://example.com/styles.css", sourceMapURL } },
                sessionId,
            );
        }
        if (snapshot) {
            await collector.takeCoverageSnapshot();
        }
        const dependencies = await collector.stop();

        assert.equal(emitter.listenerCount("styleSheetAdded"), 0);
        assert.isNotNull(dependencies);
        return dependencies as Set<string>;
    };

    [
        { title: "configured absolute root", configured: true },
        { title: "source map absolute root", configured: false },
        { title: "configured relative root", configured: true, relativeRoot: true },
        { title: "unused stylesheet", configured: true, used: false },
        { title: "lost stylesheet event", configured: true, lostEvent: true },
        { title: "coverage snapshot", configured: true, snapshot: true },
    ].forEach(({ title, configured, relativeRoot, used, lostEvent, snapshot }) => {
        it(`should apply ${title} to logical leading-slash originals`, async () => {
            const root = relativeRoot ? relative(project) : project;
            const dependencies = await collect({
                sources: ["/src/theme.css"],
                configuredRoot: configured ? root : "",
                mapRoot: configured ? "/ignored-map-root" : root,
                used,
                lostEvent,
                snapshot,
            });
            const mapper = sinon.spy(() => true);
            const normalized = transformSourceDependencies(
                { css: dependencies, js: null, png: null },
                mapper,
                "browser",
            );

            assert.deepEqual(normalized.css, [relative(original)]);
            assert.calledOnce(mapper);
            assert.deepEqual(mapper.firstCall.args, [
                {
                    scope: "browser",
                    reason: "browser-css-import",
                    relativePath: relative(original),
                },
            ]);
        });
    });

    it("should preserve a genuine existing absolute original with a relative configured root", async () => {
        const dependencies = await collect({ sources: [original], configuredRoot: "dist" });

        assert.deepEqual([...dependencies], [original]);
        assert.deepEqual(transformSourceDependencies({ css: dependencies, js: null, png: null }, null, "browser").css, [
            relative(original),
        ]);
    });

    it("should apply a dot source map root to a logical leading-slash original", async () => {
        const dependencies = await collect({ sources: [`/${relative(original)}`], mapRoot: "." });

        assert.deepEqual(transformSourceDependencies({ css: dependencies, js: null, png: null }, null, "browser").css, [
            relative(original),
        ]);
    });

    it("should preserve a genuine absolute original with a file URL root", async () => {
        const dependencies = await collect({ sources: [original], configuredRoot: pathToFileURL(project).href });

        assert.deepEqual([...dependencies], [original]);
        assert.deepEqual(transformSourceDependencies({ css: dependencies, js: null, png: null }, null, "browser").css, [
            relative(original),
        ]);
    });

    it("should not hide malformed URI escapes while checking an absolute candidate", async () => {
        await assert.isRejected(collect({ sources: ["/src/theme%.css"], configuredRoot: project }), URIError);
    });

    it("should preserve an existing encoded absolute original", async () => {
        const spacedOriginal = path.join(project, "src/spaced theme.css");
        fs.writeFileSync(spacedOriginal, ".theme { color: blue }");
        const encodedOriginal = spacedOriginal.replace("spaced theme", "spaced%20theme");
        const dependencies = await collect({ sources: [encodedOriginal], configuredRoot: "dist" });

        assert.deepEqual([...dependencies], [encodedOriginal]);
        assert.deepEqual(transformSourceDependencies({ css: dependencies, js: null, png: null }, null, "browser").css, [
            relative(spacedOriginal),
        ]);
    });

    it("should conservatively retain both existing absolute and root-prefixed originals", async () => {
        const rootedOriginal = path.posix.join(project, original);
        fs.mkdirSync(path.dirname(rootedOriginal), { recursive: true });
        fs.writeFileSync(rootedOriginal, ".theme { color: blue }");
        const dependencies = await collect({ sources: [original], configuredRoot: project });

        assert.deepEqual([...dependencies].sort(), [original, rootedOriginal].sort());
        assert.deepEqual(
            transformSourceDependencies({ css: dependencies, js: null, png: null }, null, "browser").css,
            [relative(original), relative(rootedOriginal)].sort((a, b) => a.localeCompare(b)),
        );
    });

    it("should retain missing logical originals and fail normalization instead of silently dropping them", async () => {
        const dependencies = await collect({ sources: ["/src/missing.css"], configuredRoot: project });

        assert.deepEqual([...dependencies], [path.join(project, "src/missing.css")]);
        assert.throws(
            () => transformSourceDependencies({ css: dependencies, js: null, png: null }, null, "browser"),
            /Couldn't find/,
        );
    });

    describe("URL roots downstream compatibility", () => {
        ["http://example.com", "https://example.com", "webpack://project", "runtime://generated"].forEach(
            protocolRoot => {
                [false, true].forEach(configured => {
                    it(`should allow an explicit mapper for ${
                        configured ? "configured" : "map"
                    } root ${protocolRoot}`, async () => {
                        const root = `${protocolRoot}/workspace/dist${configured ? "/" : ""}`;
                        const dependencies = await collect({
                            sources: ["src/theme.css", "../src/theme.css", "/src/theme.css"],
                            mapRoot: configured ? "/ignored-map-root" : root,
                            configuredRoot: configured ? root : "",
                        });
                        const expectedUris = [
                            `${protocolRoot}/workspace/dist/src/theme.css`,
                            `${protocolRoot}/workspace/src/theme.css`,
                        ];
                        const mapper = sinon.spy((input: { relativePath: string }) =>
                            relative(path.join(project, "src", path.posix.basename(input.relativePath))),
                        );
                        const normalized = transformSourceDependencies(
                            { css: dependencies, js: null, png: null },
                            mapper,
                            "browser",
                        );

                        assert.deepEqual([...dependencies].sort(), expectedUris.sort());
                        assert.deepEqual(normalized.css, [relative(original)]);
                        assert.deepEqual(
                            mapper
                                .getCalls()
                                .map(call => call.args[0])
                                .sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
                            expectedUris
                                .sort((a, b) => a.localeCompare(b))
                                .map(relativePath => ({
                                    scope: "browser",
                                    reason: "browser-css-import",
                                    relativePath,
                                })),
                        );
                    });
                });
            },
        );

        it("should keep ignoring unmapped unsupported URIs", async () => {
            const dependencies = await collect({
                sources: ["src/theme.css"],
                mapRoot: "runtime://generated/workspace",
            });

            assert.deepEqual(transformSourceDependencies({ css: dependencies, js: null, png: null }, null, "browser"), {
                css: [],
                js: [],
                modules: [],
                png: [],
            });
        });

        [true, false].forEach(result => {
            it(`should invoke a mapper returning ${result} for an unsupported URI without recording it`, async () => {
                const dependencies = await collect({
                    sources: ["src/theme.css"],
                    mapRoot: "runtime://generated/workspace",
                });
                const mapper = sinon.spy(() => result);

                assert.deepEqual(
                    transformSourceDependencies({ css: dependencies, js: null, png: null }, mapper, "browser"),
                    { css: [], js: [], modules: [], png: [] },
                );
                assert.calledOnce(mapper);
                assert.deepEqual(mapper.firstCall.args, [
                    {
                        scope: "browser",
                        reason: "browser-css-import",
                        relativePath: "runtime://generated/workspace/src/theme.css",
                    },
                ]);
            });
        });

        it("should reject a missing explicitly mapped local CSS original", async () => {
            const dependencies = await collect({
                sources: ["src/theme.css"],
                mapRoot: "https://example.com/workspace",
            });
            const mapper = sinon.spy(() => relative(path.join(project, "src/missing.css")));

            assert.throws(
                () => transformSourceDependencies({ css: dependencies, js: null, png: null }, mapper, "browser"),
                /Couldn't find/,
            );
            assert.calledOnce(mapper);
        });

        [false, true].forEach(configured => {
            it(`should decode percent once with a ${configured ? "configured" : "map"} file URL root`, async () => {
                const percentOriginal = path.join(project, "src/style%.css");
                fs.writeFileSync(percentOriginal, ".theme { color: blue }");
                const root = pathToFileURL(project).href;
                const dependencies = await collect({
                    sources: ["src/style%25.css"],
                    mapRoot: configured ? "/ignored-root" : root,
                    configuredRoot: configured ? root : "",
                });
                const mapper = sinon.spy(() => true);

                assert.deepEqual(
                    transformSourceDependencies({ css: dependencies, js: null, png: null }, mapper, "browser").css,
                    [relative(percentOriginal)],
                );
                assert.calledOnce(mapper);
                assert.deepEqual(mapper.firstCall.args, [
                    {
                        scope: "browser",
                        reason: "browser-css-import",
                        relativePath: relative(percentOriginal),
                    },
                ]);
            });
        });

        it("should not substitute a different existing file when the original name contains encoded percent-space", async () => {
            const percentOriginal = path.join(project, "src/style%20.css");
            fs.writeFileSync(percentOriginal, ".theme { color: blue }");
            fs.writeFileSync(path.join(project, "src/style .css"), ".theme { color: green }");
            const dependencies = await collect({
                sources: ["src/style%2520.css"],
                mapRoot: pathToFileURL(project).href,
            });

            assert.deepEqual(
                transformSourceDependencies({ css: dependencies, js: null, png: null }, null, "browser").css,
                [relative(percentOriginal)],
            );
        });

        it("should not turn a doubly encoded source directory into traversal", async () => {
            const percentOriginal = path.join(project, "src/%2e%2e/theme.css");
            fs.mkdirSync(path.dirname(percentOriginal), { recursive: true });
            fs.writeFileSync(percentOriginal, ".theme { color: blue }");
            fs.writeFileSync(path.join(project, "theme.css"), ".theme { color: green }");
            const dependencies = await collect({
                sources: ["src/%252e%252e/theme.css"],
                mapRoot: pathToFileURL(project).href,
            });

            assert.deepEqual(
                transformSourceDependencies({ css: dependencies, js: null, png: null }, null, "browser").css,
                [relative(percentOriginal)],
            );
        });

        it("should allow explicit exclusion of a file URL original whose decoded name contains percent", async () => {
            const dependencies = await collect({ sources: ["src/style%25.css"], mapRoot: pathToFileURL(project).href });
            const mapper = sinon.spy(() => false);

            assert.deepEqual(
                transformSourceDependencies({ css: dependencies, js: null, png: null }, mapper, "browser"),
                { css: [], js: [], modules: [], png: [] },
            );
            assert.calledOnce(mapper);
        });

        it("should decode explicit file URL originals once, independent of the configured root", async () => {
            const percentOriginal = path.join(project, "src/style%20.css");
            fs.writeFileSync(percentOriginal, ".theme { color: blue }");
            fs.writeFileSync(path.join(project, "src/style .css"), ".theme { color: green }");
            const dependencies = await collect({
                sources: [pathToFileURL(percentOriginal).href],
                configuredRoot: "/ignored-root",
            });

            assert.deepEqual(
                transformSourceDependencies({ css: dependencies, js: null, png: null }, null, "browser").css,
                [relative(percentOriginal)],
            );
        });

        it("should retain file URL originals containing encoded space, query and hash characters", async () => {
            const specialOriginal = path.join(project, "src/style name?x#.css");
            fs.writeFileSync(specialOriginal, ".theme { color: blue }");
            const dependencies = await collect({
                sources: ["src/style%20name%3Fx%23.css"],
                mapRoot: pathToFileURL(project).href,
            });

            assert.deepEqual(
                transformSourceDependencies({ css: dependencies, js: null, png: null }, null, "browser").css,
                [relative(specialOriginal)],
            );
        });
    });
});

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
            takeCoverageDelta: SinonStub;
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
    let hasProtocolStub: SinonStub;
    let isDataProtocolStub: SinonStub;
    let canParseStub: SinonStub;
    let debugSelectivityStub: SinonStub;

    const CacheType = { Asset: "a", CssSessionCache: "cs" };

    let getCachedSelectivityFileStub: SinonStub;
    let hasCachedSelectivityFileStub: SinonStub;
    let setCachedSelectivityFileStub: SinonStub;

    const sessionId = "test-session-id";
    const wdSessionId = "wd-session-id";
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
                takeCoverageDelta: sandbox.stub().resolves({ coverage: [] }),
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
        hasProtocolStub = sandbox.stub().returns(false);
        isDataProtocolStub = sandbox.stub().callsFake((url: string) => url.startsWith("data:"));
        // In production "urlResolve" yields an absolute (parseable) url; the stub above returns a relative one,
        // so we stub the global "URL.canParse" to mirror the production "parseable" outcome by default.
        canParseStub = sandbox.stub(URL, "canParse").returns(true);
        debugSelectivityStub = sandbox.stub();

        getCachedSelectivityFileStub = sandbox.stub().resolves(JSON.stringify(mockSourceMap));
        hasCachedSelectivityFileStub = sandbox.stub().resolves(false);
        setCachedSelectivityFileStub = sandbox.stub().resolves();

        CSSSelectivity = proxyquire("src/browser/cdp/selectivity/css-selectivity", {
            lodash: { groupBy: groupByStub },
            "node:path": path,
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
            "./debug": { debugSelectivity: debugSelectivityStub },
        }).CSSSelectivity;
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("start", () => {
        it("should set up CDP connections and start rule usage tracking", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

            await cssSelectivity.start();

            assert.calledWith(cdpMock.css.startRuleUsageTracking, sessionId);
            assert.calledOnceWith(cdpMock.css.on, "styleSheetAdded");
        });

        it("should handle styleSheetAdded events when there is no cache", async () => {
            const hasCachedSelectivityFileStubResult = Promise.resolve(false);
            const fetchTextWithBrowserFallbackStubResult = Promise.resolve("src");
            hasCachedSelectivityFileStub.returns(hasCachedSelectivityFileStubResult);
            fetchTextWithBrowserFallbackStub.returns(fetchTextWithBrowserFallbackStubResult);
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

            await cssSelectivity.start();

            const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];

            styleSheetAddedHandler(styleSheetEvent, sessionId);

            await hasCachedSelectivityFileStubResult;
            await fetchTextWithBrowserFallbackStubResult;

            assert.calledWith(fetchTextWithBrowserFallbackStub, "styles.css.map", cdpMock.runtime, sessionId);
            assert.calledWith(setCachedSelectivityFileStub, CacheType.Asset, "styles.css.map", "src");
        });

        it("should handle styleSheetAdded events when there is is cache", async () => {
            const hasCachedSelectivityFileStubResult = Promise.resolve(true);
            hasCachedSelectivityFileStub.returns(hasCachedSelectivityFileStubResult);
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

            await cssSelectivity.start();

            const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];

            styleSheetAddedHandler(styleSheetEvent, sessionId);

            await hasCachedSelectivityFileStubResult;

            assert.neverCalledWith(fetchTextWithBrowserFallbackStub, "styles.css.map");
        });

        it("should handle styleSheetAdded events for data urls", async () => {
            const sourceMapURL = "data:text/plain;base64,SGVsbG8sIFdvcmxkIQ%3D%3D";
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

            await cssSelectivity.start();

            const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];

            styleSheetAddedHandler(
                { ...styleSheetEvent, header: { ...styleSheetEvent.header, sourceMapURL } },
                sessionId,
            );

            assert.neverCalledWith(hasCachedSelectivityFileStub, CacheType.Asset, sourceMapURL);
            assert.neverCalledWith(getCachedSelectivityFileStub, CacheType.Asset, sourceMapURL);
            assert.calledWith(fetchTextWithBrowserFallbackStub, sourceMapURL);
        });

        it("should handle styleSheetAdded events without sourceURL or sourceMapURL", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

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

            styleSheetAddedHandler(styleSheetEvent, sessionId);

            assert.notCalled(fetchTextWithBrowserFallbackStub);
        });

        it("should not process events if sessionId is not set", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, "", wdSessionId, sourceRoot, null);

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

    describe("takeCoverageSnapshot", () => {
        it("should call takeCoverageDelta with sessionId", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

            await cssSelectivity.start();
            await cssSelectivity.takeCoverageSnapshot();

            assert.calledOnceWith(cdpMock.css.takeCoverageDelta, sessionId);
        });

        it("should fetch styles for unknown stylesheets", async () => {
            const cssWithSourceMap = `.test { color: red; }
/*# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozfQ==*/`;

            cdpMock.css.takeCoverageDelta.resolves({
                coverage: [{ styleSheetId: "stylesheet-999", startOffset: 0, endOffset: 50, used: true }],
            });
            cdpMock.css.getStyleSheetText.resolves({ text: cssWithSourceMap });

            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

            await cssSelectivity.start();
            await cssSelectivity.takeCoverageSnapshot();

            assert.calledWith(cdpMock.css.getStyleSheetText, sessionId, "stylesheet-999");
        });

        it("should not re-fetch already known stylesheets", async () => {
            cdpMock.css.takeCoverageDelta.resolves({
                coverage: [{ styleSheetId: "stylesheet-123", startOffset: 0, endOffset: 50, used: true }],
            });

            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

            await cssSelectivity.start();

            const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];
            styleSheetAddedHandler(styleSheetEvent, sessionId);

            await cssSelectivity.takeCoverageSnapshot();

            assert.notCalled(cdpMock.css.getStyleSheetText);
        });

        it("should accumulate coverage results used by stop()", async () => {
            const mockSourceMap = {
                sources: ["src/styles.css"],
                sourceRoot: "/root",
            };

            cdpMock.css.takeCoverageDelta.resolves({
                coverage: [{ styleSheetId: "stylesheet-123", startOffset: 0, endOffset: 50, used: true }],
            });
            cdpMock.css.stopRuleUsageTracking.resolves({
                ruleUsage: [{ styleSheetId: "stylesheet-123", startOffset: 50, endOffset: 100, used: true }],
            });
            patchSourceMapSourcesStub.returns(mockSourceMap);

            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

            await cssSelectivity.start();

            const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];
            styleSheetAddedHandler(styleSheetEvent, sessionId);

            await cssSelectivity.takeCoverageSnapshot();
            const result = await cssSelectivity.stop();

            assert.deepEqual(Array.from(result || []).sort(), ["/root/src/styles.css"]);
        });
    });

    describe("stop", () => {
        it("should return empty array when drop is true", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

            await cssSelectivity.start();
            const result = await cssSelectivity.stop(true);

            assert.deepEqual(Array.from(result || []).sort(), []);
            assert.calledOnceWith(cdpMock.css.off, "styleSheetAdded");
        });

        it("should process rule usage and return dependencies", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

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

            styleSheetAddedHandler(
                {
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
                },
                sessionId,
            );

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
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

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
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

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
            styleSheetAddedHandler(styleSheetEvent, sessionId);

            await cssSelectivity.stop();

            assert.calledWith(getCachedSelectivityFileStub, CacheType.Asset, "styles.css.map");
            assert.neverCalledWith(fetchTextWithBrowserFallbackStub, "styles.css.map");
        });

        it("should handle cache write fail for styleSheet source maps", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

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
            styleSheetAddedHandler(styleSheetEvent, sessionId);

            const result = await cssSelectivity.stop();

            assert.calledOnceWith(fetchTextWithBrowserFallbackStub, "styles.css.map");
            assert.neverCalledWith(getCachedSelectivityFileStub, CacheType.Asset, "styles.css.map");
            assert.deepEqual(Array.from(result ? result : []), ["/root/src/styles.css"]);
        });

        it("should handle non-embedded source maps without stylesheet URL", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

            const mockRuleUsage = {
                ruleUsage: [{ styleSheetId: "stylesheet-123", startOffset: 0, endOffset: 100, used: true }],
            };

            const cssWithExternalSourceMap = `.test { color: red; }
/*# sourceMappingURL=http://example.com/styles.css.map*/`;

            cdpMock.css.stopRuleUsageTracking.resolves(mockRuleUsage);
            cdpMock.css.getStyleSheetText.resolves({ text: cssWithExternalSourceMap });

            await cssSelectivity.start();

            const error: Error = (await cssSelectivity.stop().catch(err => err)) as Error;

            assert.match(error.message, /Missed stylesheet url for stylesheet id stylesheet-123/);
        });

        it("should handle stylesheet text fetch errors", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

            const mockRuleUsage = {
                ruleUsage: [{ styleSheetId: "stylesheet-123", startOffset: 0, endOffset: 100, used: true }],
            };

            const fetchError = new Error("Failed to fetch stylesheet");
            cdpMock.css.stopRuleUsageTracking.resolves(mockRuleUsage);
            cdpMock.css.getStyleSheetText.rejects(fetchError);

            await cssSelectivity.start();

            const error: Error = (await cssSelectivity.stop().catch(err => err)) as Error;

            assert.match(error.message, /Failed to fetch stylesheet/);
        });

        it("should handle source map fetch errors", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

            const mockRuleUsage = {
                ruleUsage: [{ styleSheetId: "stylesheet-123", startOffset: 0, endOffset: 100, used: true }],
            };

            const sourceMapError = new Error("Failed to fetch source map");
            cdpMock.css.stopRuleUsageTracking.resolves(mockRuleUsage);
            fetchTextWithBrowserFallbackStub.rejects(sourceMapError);

            await cssSelectivity.start();
            const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];

            styleSheetAddedHandler(
                {
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
                },
                sessionId,
            );

            const error: Error = (await cssSelectivity.stop().catch(err => err)) as Error;

            assert.match(error.message, /Failed to fetch source map/);
        });

        it("should handle files with protocols", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

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

            styleSheetAddedHandler(
                {
                    header: {
                        styleSheetId: "stylesheet-123",
                        sourceURL: "http://example.com/styles.css",
                        sourceMapURL: "styles.css.map",
                    },
                },
                sessionId,
            );

            const result = await cssSelectivity.stop();

            assert.deepEqual(Array.from(result || []).sort(), [
                "/root/src/relative.css",
                "file:///absolute/path/styles.css",
            ]);
        });

        it("should return sorted and unique dependencies", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

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

            styleSheetAddedHandler(
                {
                    header: {
                        styleSheetId: "stylesheet-123",
                        sourceURL: "http://example.com/styles1.css",
                        sourceMapURL: "styles1.css.map",
                    },
                },
                sessionId,
            );

            styleSheetAddedHandler(
                {
                    header: {
                        styleSheetId: "stylesheet-456",
                        sourceURL: "http://example.com/styles2.css",
                        sourceMapURL: "styles2.css.map",
                    },
                },
                sessionId,
            );

            const result = await cssSelectivity.stop();

            assert.deepEqual(Array.from(result || []).sort(), [
                "/root/src/a-styles.css",
                "/root/src/b-styles.css",
                "/root/src/z-styles.css",
            ]);
        });

        [
            {
                title: "should prepend a configured source root to missing logical leading-slash originals",
                configuredRoot: sourceRoot,
                mapRoot: "/map-root",
                sources: ["/absolute/path/styles.css", "src/theme.css"],
                dependencies: [`${sourceRoot}/absolute/path/styles.css`, `${sourceRoot}/src/theme.css`],
                used: true,
            },
            {
                title: "should prepend the source map root to missing logical leading-slash originals",
                configuredRoot: "",
                mapRoot: "/map-root",
                sources: ["/absolute/path/styles.css", "src/theme.css"],
                dependencies: ["/map-root/absolute/path/styles.css", "/map-root/src/theme.css"],
                used: true,
            },
            {
                title: "should retain relative and file URL originals for unused stylesheet rules",
                configuredRoot: sourceRoot,
                mapRoot: "/map-root",
                sources: ["file:///absolute/path/styles.css", "src/theme.css", "<no source>", ""],
                dependencies: ["file:///absolute/path/styles.css", `${sourceRoot}/src/theme.css`],
                used: false,
            },
        ].forEach(({ title, configuredRoot, mapRoot, sources, dependencies, used }) => {
            it(title, async () => {
                const sourceMap = { ...mockSourceMap, sources, sourceRoot: mapRoot };
                getCachedSelectivityFileStub.resolves(null);
                setCachedSelectivityFileStub.rejects(new Error("fs-cache unavailable"));
                fetchTextWithBrowserFallbackStub.resolves(JSON.stringify(sourceMap));
                patchSourceMapSourcesStub.callsFake(patchSourceMapSources);
                hasProtocolStub.callsFake(hasProtocol);
                cdpMock.css.stopRuleUsageTracking.resolves({
                    ruleUsage: [{ styleSheetId: "stylesheet-123", startOffset: 0, endOffset: 100, used }],
                });
                const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, configuredRoot, null);

                await cssSelectivity.start();
                cdpMock.css.on.getCall(0).args[1](styleSheetEvent, sessionId);
                const result = await cssSelectivity.stop();

                assert.deepEqual(Array.from(result || []).sort(), dependencies.sort());
            });
        });

        [
            { root: "file:///workspace", configured: false },
            { root: "file:///workspace/", configured: false },
            { root: "http://example.com/workspace", configured: false },
            { root: "https://example.com/workspace/", configured: false },
            { root: "file:///configured/workspace", configured: true },
            { root: "runtime://generated/workspace", configured: false },
        ].forEach(({ root, configured }) => {
            it(`should resolve relative originals with ${
                configured ? "configured" : "map"
            } URL root ${root}`, async () => {
                const relativeSources = ["src/styles.css", "../src/theme.css", "/absolute/path/styles.css"];
                const unchangedSources = [
                    "file:///absolute/path/styles.css",
                    "https://other.example.com/styles.css",
                    "turbopack://generated/styles.css",
                ];
                const sourceMap = {
                    ...mockSourceMap,
                    version: 3 as const,
                    sources: [...relativeSources, ...unchangedSources],
                    sourceRoot: configured ? "/original-root" : root,
                };
                const configuredRoot = configured ? root : "";
                const expectedRelativeSources = new TraceMap(
                    patchSourceMapSources({ ...sourceMap, sources: relativeSources }, configuredRoot),
                ).resolvedSources;
                getCachedSelectivityFileStub.resolves(null);
                setCachedSelectivityFileStub.rejects(new Error("fs-cache unavailable"));
                fetchTextWithBrowserFallbackStub.resolves(JSON.stringify(sourceMap));
                patchSourceMapSourcesStub.callsFake(patchSourceMapSources);
                hasProtocolStub.callsFake(hasProtocol);
                urlResolveStub.callsFake(urlResolve);
                const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, configuredRoot, null);

                await cssSelectivity.start();
                cdpMock.css.on.getCall(0).args[1](styleSheetEvent, sessionId);
                const result = await cssSelectivity.stop();

                assert.deepEqual(
                    Array.from(result || []).sort(),
                    [...expectedRelativeSources, ...unchangedSources].sort(),
                );
                if (root.startsWith("runtime://")) {
                    const unsupportedDeps = new Set(
                        Array.from(result || []).filter(source => source.startsWith("runtime://")),
                    );
                    assert.equal(unsupportedDeps.size, relativeSources.length);
                    const normalized = transformSourceDependencies(
                        { css: unsupportedDeps, js: null, png: null },
                        null,
                        "browser",
                    );

                    assert.deepEqual(normalized, { css: [], js: [], modules: [], png: [] });
                }
            });
        });
    });

    describe("mapSourceMapUrl", () => {
        it("should skip stylesheet when mapSourceMapUrl returns falsy", async () => {
            const mapSourceMapUrl = sinon.stub().returns(false);
            const cssSelectivity = new CSSSelectivity(
                cdpMock as any,
                sessionId,
                wdSessionId,
                sourceRoot,
                mapSourceMapUrl,
            );

            await cssSelectivity.start();

            const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];
            styleSheetAddedHandler(styleSheetEvent, sessionId);

            cdpMock.css.stopRuleUsageTracking.resolves({
                ruleUsage: [{ styleSheetId: "stylesheet-123", startOffset: 0, endOffset: 100, used: true }],
            });

            const result = await cssSelectivity.stop();

            assert.calledOnceWith(mapSourceMapUrl, {
                type: "css",
                sourceUrl: "http://example.com/styles.css",
                sourceMapUrl: "styles.css.map",
            });
            assert.notCalled(fetchTextWithBrowserFallbackStub);
            assert.deepEqual(Array.from(result || []), []);
        });

        it("should not get filtered out stylesheets", async () => {
            const mapSourceMapUrl = sinon.stub().returns(false);
            const cssSelectivity = new CSSSelectivity(
                cdpMock as any,
                sessionId,
                wdSessionId,
                sourceRoot,
                mapSourceMapUrl,
            );

            await cssSelectivity.start();

            const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];
            styleSheetAddedHandler(styleSheetEvent, sessionId);

            // Coverage refers to the same stylesheet that was filtered
            cdpMock.css.takeCoverageDelta.resolves({
                coverage: [{ styleSheetId: "stylesheet-123", startOffset: 0, endOffset: 50, used: true }],
            });

            await cssSelectivity.takeCoverageSnapshot();

            assert.notCalled(cdpMock.css.getStyleSheetText);
        });

        it("should replace source map URL when mapSourceMapUrl returns a string", async () => {
            const mapSourceMapUrl = sinon.stub().returns("http://cdn.example.com/remapped-styles.css.map");
            const cssSelectivity = new CSSSelectivity(
                cdpMock as any,
                sessionId,
                wdSessionId,
                sourceRoot,
                mapSourceMapUrl,
            );

            const hasCachedSelectivityFileStubResult = Promise.resolve(false);
            const fetchTextWithBrowserFallbackStubResult = Promise.resolve(JSON.stringify(mockSourceMap));
            hasCachedSelectivityFileStub.returns(hasCachedSelectivityFileStubResult);
            fetchTextWithBrowserFallbackStub.returns(fetchTextWithBrowserFallbackStubResult);

            await cssSelectivity.start();

            const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];
            styleSheetAddedHandler(styleSheetEvent, sessionId);

            await hasCachedSelectivityFileStubResult;
            await fetchTextWithBrowserFallbackStubResult;

            assert.calledWith(
                fetchTextWithBrowserFallbackStub,
                "http://cdn.example.com/remapped-styles.css.map",
                cdpMock.runtime,
                sessionId,
            );
        });

        it("should pass through when mapSourceMapUrl returns true", async () => {
            const mapSourceMapUrl = sinon.stub().returns(true);
            const cssSelectivity = new CSSSelectivity(
                cdpMock as any,
                sessionId,
                wdSessionId,
                sourceRoot,
                mapSourceMapUrl,
            );

            const hasCachedSelectivityFileStubResult = Promise.resolve(false);
            const fetchTextWithBrowserFallbackStubResult = Promise.resolve(JSON.stringify(mockSourceMap));
            hasCachedSelectivityFileStub.returns(hasCachedSelectivityFileStubResult);
            fetchTextWithBrowserFallbackStub.returns(fetchTextWithBrowserFallbackStubResult);

            await cssSelectivity.start();

            const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];
            styleSheetAddedHandler(styleSheetEvent, sessionId);

            await hasCachedSelectivityFileStubResult;
            await fetchTextWithBrowserFallbackStubResult;

            assert.calledWith(fetchTextWithBrowserFallbackStub, "styles.css.map", cdpMock.runtime, sessionId);
        });

        it("should not call mapSourceMapUrl when no mapSourceMapUrl is provided", async () => {
            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

            const hasCachedSelectivityFileStubResult = Promise.resolve(false);
            const fetchTextWithBrowserFallbackStubResult = Promise.resolve(JSON.stringify(mockSourceMap));
            hasCachedSelectivityFileStub.returns(hasCachedSelectivityFileStubResult);
            fetchTextWithBrowserFallbackStub.returns(fetchTextWithBrowserFallbackStubResult);

            await cssSelectivity.start();

            const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];
            styleSheetAddedHandler(styleSheetEvent, sessionId);

            await hasCachedSelectivityFileStubResult;
            await fetchTextWithBrowserFallbackStubResult;

            assert.calledWith(fetchTextWithBrowserFallbackStub, "styles.css.map", cdpMock.runtime, sessionId);
        });
    });

    describe("session cache", () => {
        describe("loading cache at the start", () => {
            it("should load session cache on start", async () => {
                getCachedSelectivityFileStub.withArgs(CacheType.CssSessionCache, wdSessionId).resolves(null);

                const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

                await cssSelectivity.start();

                assert.calledWith(getCachedSelectivityFileStub, CacheType.CssSessionCache, wdSessionId);
            });

            it("should restore source maps from session cache", async () => {
                const sessionCache = {
                    "stylesheet-123": {
                        sourceMapUrl: "styles.css.map",
                        sourceMap: JSON.stringify(mockSourceMap),
                        isError: false,
                    },
                };

                getCachedSelectivityFileStub
                    .withArgs(CacheType.CssSessionCache, wdSessionId)
                    .resolves(JSON.stringify(sessionCache));
                patchSourceMapSourcesStub.returns(mockSourceMap);

                const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

                await cssSelectivity.start();

                // Trigger stop to verify the restored source map is used
                cdpMock.css.stopRuleUsageTracking.resolves({
                    ruleUsage: [{ styleSheetId: "stylesheet-123", startOffset: 0, endOffset: 100, used: true }],
                });

                const result = await cssSelectivity.stop();

                // Should not need to fetch from browser since source map was restored from cache
                assert.neverCalledWith(cdpMock.css.getStyleSheetText, sessionId, "stylesheet-123");
                assert.deepEqual(Array.from(result || []).sort(), ["/root/src/styles.css", "/root/src/theme.css"]);
            });

            it("should handle empty session cache gracefully", async () => {
                getCachedSelectivityFileStub.withArgs(CacheType.CssSessionCache, wdSessionId).resolves(null);

                const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

                await cssSelectivity.start();

                assert.calledWith(getCachedSelectivityFileStub, CacheType.CssSessionCache, wdSessionId);
            });

            it("should handle invalid JSON in session cache", async () => {
                getCachedSelectivityFileStub
                    .withArgs(CacheType.CssSessionCache, wdSessionId)
                    .resolves("invalid-json{{{");

                const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

                await cssSelectivity.start();

                assert.calledWith(
                    debugSelectivityStub,
                    sinon.match(/CSS Session cache is invalid JSON/),
                    sinon.match.any,
                );
            });

            it("should restore error entries without sourceMapUrl as broken session errors", async () => {
                const sessionCache = {
                    "stylesheet-999": {
                        sourceMapUrl: null,
                        sourceMap: "Error: failed to fetch\nSome details",
                        isError: true,
                    },
                };

                getCachedSelectivityFileStub
                    .withArgs(CacheType.CssSessionCache, wdSessionId)
                    .resolves(JSON.stringify(sessionCache));

                const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

                await cssSelectivity.start();

                // Trigger stop to see the restored error
                cdpMock.css.stopRuleUsageTracking.resolves({
                    ruleUsage: [{ styleSheetId: "stylesheet-999", startOffset: 0, endOffset: 50, used: true }],
                });

                const error: Error = (await cssSelectivity.stop().catch((err: Error) => err)) as Error;

                assert.match(error.message, /Selectivity: session is broken/);
            });

            it("should not restore source map for error entries with sourceMapUrl", async () => {
                const sessionCache = {
                    "stylesheet-456": {
                        sourceMapUrl: "http://example.com/styles.css.map",
                        sourceMap: "Error: temporary failure",
                        isError: true,
                    },
                };

                getCachedSelectivityFileStub
                    .withArgs(CacheType.CssSessionCache, wdSessionId)
                    .resolves(JSON.stringify(sessionCache));
                // getCachedSelectivityFile for Asset type returns the cached source map when _ensureStylesAreLoading triggers
                getCachedSelectivityFileStub
                    .withArgs(CacheType.Asset, "http://example.com/styles.css.map")
                    .resolves(JSON.stringify(mockSourceMap));
                patchSourceMapSourcesStub.returns(mockSourceMap);

                const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

                await cssSelectivity.start();

                cdpMock.css.stopRuleUsageTracking.resolves({
                    ruleUsage: [{ styleSheetId: "stylesheet-456", startOffset: 0, endOffset: 100, used: true }],
                });

                // Should not throw because it can try to re-fetch the source map via _ensureStylesAreLoading
                const result = await cssSelectivity.stop();

                assert.deepEqual(Array.from(result || []).sort(), ["/root/src/styles.css", "/root/src/theme.css"]);
            });

            it("should handle session cache load error gracefully", async () => {
                getCachedSelectivityFileStub
                    .withArgs(CacheType.CssSessionCache, wdSessionId)
                    .rejects(new Error("fs read error"));

                const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

                // Should not throw - session cache load error is caught
                await cssSelectivity.start();

                assert.calledWith(debugSelectivityStub, sinon.match(/Couldn't load session cache/), sinon.match.any);
            });

            it("should throw if startRuleUsageTracking fails even if cache loads successfully", async () => {
                const trackingError = new Error("CDP tracking failed");
                cdpMock.css.startRuleUsageTracking.rejects(trackingError);
                getCachedSelectivityFileStub.withArgs(CacheType.CssSessionCache, wdSessionId).resolves(null);

                const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

                await assert.isRejected(cssSelectivity.start(), "CDP tracking failed");
            });
        });

        describe("saving cache at the end", () => {
            it("should save session cache with source map data on stop", async () => {
                const mockSourceMapJson = JSON.stringify(mockSourceMap);
                patchSourceMapSourcesStub.returns(mockSourceMap);
                hasCachedSelectivityFileStub.resolves(false);
                fetchTextWithBrowserFallbackStub.resolves(mockSourceMapJson);
                getCachedSelectivityFileStub.withArgs(CacheType.CssSessionCache, wdSessionId).resolves(null);

                const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

                await cssSelectivity.start();

                const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];
                styleSheetAddedHandler(styleSheetEvent, sessionId);

                cdpMock.css.stopRuleUsageTracking.resolves({
                    ruleUsage: [{ styleSheetId: "stylesheet-123", startOffset: 0, endOffset: 100, used: true }],
                });

                await cssSelectivity.stop();

                assert.calledWith(
                    setCachedSelectivityFileStub,
                    CacheType.CssSessionCache,
                    wdSessionId,
                    sinon.match.string,
                );

                const savedCacheString = setCachedSelectivityFileStub
                    .getCalls()
                    .find((call: any) => call.args[0] === CacheType.CssSessionCache)?.args[2];
                const savedCache = JSON.parse(savedCacheString);

                assert.equal(savedCache["stylesheet-123"].sourceMapUrl, "styles.css.map");
                assert.isFalse(savedCache["stylesheet-123"].isError);
            });

            it("should save error message in session cache when source map fetch fails for non-covered stylesheet", async () => {
                const fetchError = new Error("Failed to fetch source map");
                getCachedSelectivityFileStub.withArgs(CacheType.CssSessionCache, wdSessionId).resolves(null);
                hasCachedSelectivityFileStub.resolves(false);
                fetchTextWithBrowserFallbackStub.rejects(fetchError);

                const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

                await cssSelectivity.start();

                const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];
                // Register stylesheet that will fail to fetch source map
                styleSheetAddedHandler(styleSheetEvent, sessionId);

                // Coverage does NOT include stylesheet-123, so stop() won't throw
                cdpMock.css.stopRuleUsageTracking.resolves({
                    ruleUsage: [],
                });

                await cssSelectivity.stop();

                const sessionCacheCall = setCachedSelectivityFileStub
                    .getCalls()
                    .find((call: any) => call.args[0] === CacheType.CssSessionCache);

                assert.isDefined(sessionCacheCall);

                const savedCache = JSON.parse(sessionCacheCall!.args[2]);
                assert.isTrue(savedCache["stylesheet-123"].isError);
                assert.equal(savedCache["stylesheet-123"].sourceMap, "Failed to fetch source map");
            });

            it("should not save session cache when drop is true", async () => {
                getCachedSelectivityFileStub.withArgs(CacheType.CssSessionCache, wdSessionId).resolves(null);

                const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

                await cssSelectivity.start();

                await cssSelectivity.stop(true);

                assert.neverCalledWith(
                    setCachedSelectivityFileStub,
                    CacheType.CssSessionCache,
                    sinon.match.any,
                    sinon.match.any,
                );
            });

            it("should handle session cache save failure gracefully", async () => {
                getCachedSelectivityFileStub.withArgs(CacheType.CssSessionCache, wdSessionId).resolves(null);
                patchSourceMapSourcesStub.returns(mockSourceMap);

                // Make the session cache save fail
                setCachedSelectivityFileStub.withArgs(CacheType.CssSessionCache).rejects(new Error("fs write error"));

                const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

                await cssSelectivity.start();

                const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];
                styleSheetAddedHandler(styleSheetEvent, sessionId);

                cdpMock.css.stopRuleUsageTracking.resolves({
                    ruleUsage: [{ styleSheetId: "stylesheet-123", startOffset: 0, endOffset: 100, used: true }],
                });

                // Should not throw even though session cache save fails
                const result = await cssSelectivity.stop();

                assert.calledWith(
                    debugSelectivityStub,
                    sinon.match(/Couldn't save session cache/),
                    sinon.match.any,
                    sinon.match.any,
                );
                assert.deepEqual(Array.from(result || []).sort(), ["/root/src/styles.css", "/root/src/theme.css"]);
            });
        });

        describe("_ensureStylesAreLoading with session cache", () => {
            it("should use cached source map url from session cache to fetch source map", async () => {
                const sessionCache = {
                    "stylesheet-789": {
                        sourceMapUrl: "http://example.com/restored.css.map",
                        sourceMap: null,
                        isError: true,
                    },
                };

                getCachedSelectivityFileStub
                    .withArgs(CacheType.CssSessionCache, wdSessionId)
                    .resolves(JSON.stringify(sessionCache));
                getCachedSelectivityFileStub
                    .withArgs(CacheType.Asset, "http://example.com/restored.css.map")
                    .resolves(JSON.stringify(mockSourceMap));
                patchSourceMapSourcesStub.returns(mockSourceMap);

                const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

                await cssSelectivity.start();

                cdpMock.css.stopRuleUsageTracking.resolves({
                    ruleUsage: [{ styleSheetId: "stylesheet-789", startOffset: 0, endOffset: 100, used: true }],
                });

                const result = await cssSelectivity.stop();

                // Should fetch from cache, not from browser
                assert.calledWith(getCachedSelectivityFileStub, CacheType.Asset, "http://example.com/restored.css.map");
                assert.deepEqual(Array.from(result || []).sort(), ["/root/src/styles.css", "/root/src/theme.css"]);
            });

            it("should cache fetched source map to fs after fallback fetch", async () => {
                const sessionCache = {
                    "stylesheet-789": {
                        sourceMapUrl: "http://example.com/restored.css.map",
                        sourceMap: null,
                        isError: true,
                    },
                };

                getCachedSelectivityFileStub
                    .withArgs(CacheType.CssSessionCache, wdSessionId)
                    .resolves(JSON.stringify(sessionCache));
                getCachedSelectivityFileStub
                    .withArgs(CacheType.Asset, "http://example.com/restored.css.map")
                    .resolves(null);
                fetchTextWithBrowserFallbackStub.resolves(JSON.stringify(mockSourceMap));
                patchSourceMapSourcesStub.returns(mockSourceMap);

                const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

                await cssSelectivity.start();

                cdpMock.css.stopRuleUsageTracking.resolves({
                    ruleUsage: [{ styleSheetId: "stylesheet-789", startOffset: 0, endOffset: 100, used: true }],
                });

                await cssSelectivity.stop();

                assert.calledWith(
                    setCachedSelectivityFileStub,
                    CacheType.Asset,
                    "http://example.com/restored.css.map",
                    JSON.stringify(mockSourceMap),
                );
            });

            it("should not cache fetched source map if fallback fetch fails", async () => {
                const sessionCache = {
                    "stylesheet-789": {
                        sourceMapUrl: "http://example.com/restored.css.map",
                        sourceMap: null,
                        isError: true,
                    },
                };

                getCachedSelectivityFileStub
                    .withArgs(CacheType.CssSessionCache, wdSessionId)
                    .resolves(JSON.stringify(sessionCache));
                getCachedSelectivityFileStub
                    .withArgs(CacheType.Asset, "http://example.com/restored.css.map")
                    .resolves(null);
                fetchTextWithBrowserFallbackStub.rejects(new Error("network error"));

                const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

                await cssSelectivity.start();

                cdpMock.css.stopRuleUsageTracking.resolves({
                    ruleUsage: [{ styleSheetId: "stylesheet-789", startOffset: 0, endOffset: 100, used: true }],
                });

                await cssSelectivity.stop().catch(() => {});

                assert.neverCalledWith(
                    setCachedSelectivityFileStub,
                    CacheType.Asset,
                    "http://example.com/restored.css.map",
                    sinon.match.any,
                );
            });
        });
    });

    describe("anonymous stylesheets with embedded source maps", () => {
        const embeddedSourceMapUrl = "data:application/json;base64,eyJ2ZXJzaW9uIjozfQ==";
        const anonymousStyleSheetEvent = {
            header: {
                ...styleSheetEvent.header,
                sourceURL: "", // anonymous stylesheet (e.g. injected <style>)
                sourceMapURL: embeddedSourceMapUrl,
            },
        };

        it("should fetch the embedded source map for a stylesheet without a sourceURL", async () => {
            patchSourceMapSourcesStub.returns({ sources: ["src/styles.css"], sourceRoot: "/root" });
            cdpMock.css.stopRuleUsageTracking.resolves({
                ruleUsage: [{ styleSheetId: "stylesheet-123", startOffset: 0, endOffset: 100, used: true }],
            });

            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

            await cssSelectivity.start();

            const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];
            styleSheetAddedHandler(anonymousStyleSheetEvent, sessionId);

            const result = await cssSelectivity.stop();

            // Embedded (data:) source maps are fetched directly and never offloaded to fs-cache
            assert.calledWith(fetchTextWithBrowserFallbackStub, embeddedSourceMapUrl, cdpMock.runtime, sessionId);
            assert.neverCalledWith(hasCachedSelectivityFileStub, CacheType.Asset, embeddedSourceMapUrl);
            assert.neverCalledWith(setCachedSelectivityFileStub, CacheType.Asset, embeddedSourceMapUrl);
            assert.deepEqual(Array.from(result || []).sort(), ["/root/src/styles.css"]);
        });

        it("should skip the stylesheet when the resolved source map url is not parseable", async () => {
            canParseStub.returns(false);
            cdpMock.css.stopRuleUsageTracking.resolves({
                ruleUsage: [{ styleSheetId: "stylesheet-123", startOffset: 0, endOffset: 100, used: true }],
            });

            const cssSelectivity = new CSSSelectivity(cdpMock as any, sessionId, wdSessionId, sourceRoot, null);

            await cssSelectivity.start();

            const styleSheetAddedHandler = cdpMock.css.on.getCall(0).args[1];
            styleSheetAddedHandler(styleSheetEvent, sessionId);

            const result = await cssSelectivity.stop();

            assert.notCalled(fetchTextWithBrowserFallbackStub);
            assert.deepEqual(Array.from(result || []), []);
        });
    });
});
