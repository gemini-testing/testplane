import sinon, { type SinonStub } from "sinon";
import proxyquire from "proxyquire";
import type { CDP } from "src/browser/cdp";
import type { JSSelectivity as JSCollector } from "src/browser/cdp/selectivity/js-selectivity";
import type { CSSSelectivity as CSSCollector } from "src/browser/cdp/selectivity/css-selectivity";
import type { SelectivityMapSourceMapUrlFn } from "src/config/types";

describe("CDP/Selectivity/empty declared source maps", () => {
    const sandbox = sinon.createSandbox();
    const sessionId = "empty-map-session";
    const sourceRoot = "/test/source-root";
    const sourceUrl = "https://example.com/app.js";
    const scriptSource = "function render() { return 1; }";
    const validMap = JSON.stringify({ version: 3, sources: ["src/app.js"], names: [], mappings: "AAAA" });
    let JSSelectivity: typeof import("src/browser/cdp/selectivity/js-selectivity").JSSelectivity;
    let CSSSelectivity: typeof import("src/browser/cdp/selectivity/css-selectivity").CSSSelectivity;
    let utils: typeof import("src/browser/cdp/selectivity/utils");
    let fetchStub: SinonStub;
    let fsCacheStubs: {
        getCachedSelectivityFile: SinonStub;
        hasCachedSelectivityFile: SinonStub;
        setCachedSelectivityFile: SinonStub;
    };

    // Both production collectors share these small CDP I/O doubles.
    const createCdpMock = (): any => ({
        debugger: {
            on: sandbox.stub(),
            off: sandbox.stub(),
            getScriptSource: sandbox.stub().resolves({ scriptSource }),
        },
        profiler: {
            startPreciseCoverage: sandbox.stub().resolves(),
            takePreciseCoverage: sandbox.stub().resolves({
                result: [
                    {
                        scriptId: "asset",
                        url: sourceUrl,
                        functions: [
                            {
                                functionName: "render",
                                isBlockCoverage: false,
                                ranges: [{ startOffset: 0, endOffset: scriptSource.length, count: 1 }],
                            },
                        ],
                    },
                ],
            }),
        },
        css: {
            on: sandbox.stub(),
            off: sandbox.stub(),
            startRuleUsageTracking: sandbox.stub().resolves(),
            stopRuleUsageTracking: sandbox.stub().resolves({
                ruleUsage: [{ styleSheetId: "asset", startOffset: 0, endOffset: 10, used: true }],
            }),
        },
        runtime: {},
    });
    let cdpMock: ReturnType<typeof createCdpMock>;

    beforeEach(() => {
        cdpMock = createCdpMock();
        fetchStub = sandbox.stub(globalThis, "fetch").resolves(new Response("", { status: 200 }));
        // Prevent asset offloading so the collectors see the actually fetched string, including "".
        fsCacheStubs = {
            getCachedSelectivityFile: sandbox.stub().resolves(null),
            hasCachedSelectivityFile: sandbox.stub().resolves(false),
            setCachedSelectivityFile: sandbox.stub().rejects(new Error("File cache disabled")),
        };

        utils = proxyquire("src/browser/cdp/selectivity/utils", { "./fs-cache": fsCacheStubs });
        const dependencies = { "./utils": utils, "./fs-cache": fsCacheStubs };
        JSSelectivity = proxyquire("src/browser/cdp/selectivity/js-selectivity", dependencies).JSSelectivity;
        CSSSelectivity = proxyquire("src/browser/cdp/selectivity/css-selectivity", dependencies).CSSSelectivity;
    });

    afterEach(() => sandbox.restore());

    const enableFileCache = (): void => {
        const files = new Map<string, string>();
        fsCacheStubs.getCachedSelectivityFile.callsFake((type: string, key: string) =>
            Promise.resolve(files.get(JSON.stringify([type, key])) ?? null),
        );
        fsCacheStubs.setCachedSelectivityFile.callsFake((type: string, key: string, contents: string) => {
            files.set(JSON.stringify([type, key]), contents);
            return Promise.resolve();
        });
    };

    const startCollector = async (
        type: "js" | "css",
        mapSourceMapUrl: SelectivityMapSourceMapUrlFn | null = null,
    ): Promise<JSCollector | CSSCollector> => {
        const cdp = cdpMock as unknown as CDP;
        const collector =
            type === "js"
                ? new JSSelectivity(cdp, sessionId, sourceRoot, mapSourceMapUrl)
                : new CSSSelectivity(cdp, sessionId, "webdriver-session", sourceRoot, mapSourceMapUrl);

        await collector.start();

        if (type === "js") {
            cdpMock.debugger.on
                .getCall(0)
                .args[1](
                    { scriptId: "asset", url: sourceUrl, sourceMapURL: "app.js.map", hash: "app-hash" },
                    sessionId,
                );
        } else {
            cdpMock.css.on.getCall(0).args[1](
                {
                    header: {
                        styleSheetId: "asset",
                        frameId: "frame",
                        sourceURL: "https://example.com/app.css",
                        sourceMapURL: "app.css.map",
                        origin: "regular",
                        title: "app.css",
                        disabled: false,
                        isInline: false,
                        isMutable: false,
                        isConstructed: false,
                        startLine: 0,
                        startColumn: 0,
                        length: 10,
                        endLine: 0,
                        endColumn: 10,
                    },
                },
                sessionId,
            );
        }

        return collector;
    };

    for (const type of ["js", "css"] as const) {
        for (const cached of [false, true]) {
            it(`should reject an HTTP 200 empty ${type} map as invalid JSON (${
                cached ? "cached" : "uncached"
            })`, async () => {
                if (cached) enableFileCache();
                const collector = await startCollector(type);

                await assert.isRejected(collector.stop(), SyntaxError);
                assert.calledOnceWithExactly(fetchStub, `https://example.com/app.${type}.map`);
            });
        }

        it(`should preserve intentional null mapper exclusion for ${type}`, async () => {
            const excludeMap = sandbox.stub().returns(null);
            const collector = await startCollector(type, excludeMap);

            assert.deepEqual(Array.from((await collector.stop()) || []), []);
            assert.calledOnce(excludeMap);
            assert.notCalled(fetchStub);
        });

        it(`should keep the cache-miss error for a missing cached ${type} map`, async () => {
            enableFileCache();
            const mapUrl = `https://example.com/app.${type}.map`;
            fsCacheStubs.getCachedSelectivityFile.withArgs(sinon.match.any, mapUrl).resolves(null);
            fetchStub.resolves(new Response(validMap, { status: 200 }));
            const collector = await startCollector(type);

            await assert.isRejected(
                collector.stop(),
                Error,
                `${type.toUpperCase()} Selectivity: fs-cache is broken for ${type === "js" ? sourceUrl : mapUrl}`,
            );
        });
    }

    for (const cached of [false, true]) {
        it(`should allow an empty JavaScript asset with a valid map (${cached ? "cached" : "uncached"})`, async () => {
            if (cached) enableFileCache();
            fetchStub.resolves(new Response(validMap, { status: 200 }));
            cdpMock.debugger.getScriptSource.resolves({ scriptSource: "" });
            cdpMock.profiler.takePreciseCoverage.resolves({
                result: [{ scriptId: "asset", url: sourceUrl, functions: [] }],
            });
            const collector = await startCollector("js");

            assert.deepEqual(Array.from((await collector.stop()) || []), []);
            assert.calledOnceWithExactly(fetchStub, "https://example.com/app.js.map");
        });
    }

    it("should preserve an HTTP 200 empty asset in the generic fetch helper", async () => {
        assert.strictEqual(await utils.fetchTextWithBrowserFallback(sourceUrl, cdpMock.runtime, sessionId), "");
        assert.calledOnceWithExactly(fetchStub, sourceUrl);
    });

    it("should collect valid JavaScript maps with the real parser and extractor", async () => {
        fetchStub.resolves(new Response(validMap, { status: 200 }));
        const collector = await startCollector("js");

        assert.deepEqual(Array.from((await collector.stop()) || []), [`${sourceRoot}/src/app.js`]);
    });

    it("should collect valid CSS maps with the real JSON parser", async () => {
        fetchStub.resolves(new Response(validMap.replace("app.js", "app.css"), { status: 200 }));
        const collector = await startCollector("css");

        assert.deepEqual(Array.from((await collector.stop()) || []), [`${sourceRoot}/src/app.css`]);
    });
});
