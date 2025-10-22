import sinon, { SinonStub, type SinonStubbedInstance } from "sinon";
import proxyquire from "proxyquire";
import type { CDPRuntime } from "src/browser/cdp/domains/runtime";

describe("CDP/Selectivity/Utils", () => {
    const sandbox = sinon.createSandbox();
    let utils: typeof import("src/browser/cdp/selectivity/utils");
    let fetchStub: SinonStub;
    let fsStub: { existsSync: SinonStub };
    let pathStub: { posix: { relative: SinonStub; resolve: SinonStub; join: SinonStub; sep: string } };
    let softFileURLToPathStub: SinonStub;
    let SourceMapConsumerStub: SinonStub;

    beforeEach(() => {
        fetchStub = sandbox.stub(globalThis, "fetch").resolves({
            text: sandbox.stub().resolves("mocked response"),
            ok: true,
            status: 200,
            headers: new Headers(),
            redirected: false,
            statusText: "OK",
            type: "basic",
            url: "",
            clone: sandbox.stub(),
            body: null,
            bodyUsed: false,
            arrayBuffer: sandbox.stub(),
            blob: sandbox.stub(),
            formData: sandbox.stub(),
            json: sandbox.stub(),
        });
        fsStub = { existsSync: sandbox.stub().returns(true) };
        pathStub = {
            posix: {
                relative: sandbox.stub().returnsArg(1),
                resolve: sandbox.stub().returnsArg(0),
                join: sandbox.stub().callsFake((...args) => args.join("/")),
                sep: "/",
            },
        };
        softFileURLToPathStub = sandbox.stub().returnsArg(0);
        SourceMapConsumerStub = sandbox.stub();

        utils = proxyquire("src/browser/cdp/selectivity/utils", {
            fs: fsStub,
            path: pathStub,
            "source-map": {
                SourceMapConsumer: SourceMapConsumerStub,
            },
            "../../../utils/fs": {
                softFileURLToPath: softFileURLToPathStub,
            },
        });
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("fetchTextWithBrowserFallback", () => {
        let runtimeStub: SinonStubbedInstance<CDPRuntime>;
        const sessionId = "test-session-id";

        beforeEach(() => {
            runtimeStub = { evaluate: sandbox.stub() } as SinonStubbedInstance<CDPRuntime>;
        });

        it("should fetch embedded source maps directly", async () => {
            const dataUrl = "data:application/json;base64,eyJ2ZXJzaW9uIjozfQ==";
            fetchStub.resolves({ text: () => Promise.resolve("source map content") });

            const result = await utils.fetchTextWithBrowserFallback(dataUrl, runtimeStub, sessionId);

            assert.equal(result, "source map content");
            assert.calledOnceWith(fetchStub, dataUrl);
            assert.notCalled(runtimeStub.evaluate);
        });

        it("should try direct fetch first for non-embedded URLs", async () => {
            const url = "http://example.com/sourcemap.js.map";
            fetchStub.resolves({ text: () => Promise.resolve("source map content") });

            const result = await utils.fetchTextWithBrowserFallback(url, runtimeStub, sessionId);

            assert.equal(result, "source map content");
            assert.calledOnceWith(fetchStub, url);
            assert.notCalled(runtimeStub.evaluate);
        });

        it("should fallback to browser evaluation if direct fetch fails", async () => {
            const url = "http://example.com/sourcemap.js.map";
            fetchStub.rejects(new Error("Network error"));
            runtimeStub.evaluate.resolves({ result: { type: "string", value: "browser fetched content" } });

            const result = await utils.fetchTextWithBrowserFallback(url, runtimeStub, sessionId);

            assert.equal(result, "browser fetched content");
            assert.calledOnceWith(fetchStub, url);
            assert.calledOnceWith(runtimeStub.evaluate, sessionId, {
                expression: `fetch("${url}").then(r => r.text())`,
                awaitPromise: true,
                returnByValue: true,
            });
        });

        it("should return error if both fetch methods fail", async () => {
            const url = "http://example.com/sourcemap.js.map";
            const browserError = new Error("Browser fetch failed");
            fetchStub.rejects(new Error("Network error"));
            runtimeStub.evaluate.rejects(browserError);

            const result = await utils.fetchTextWithBrowserFallback(url, runtimeStub, sessionId);

            assert.instanceOf(result, Error);
            assert.equal((result as Error).message, "Browser fetch failed");
        });

        it("should return error if embedded source map fetch fails", async () => {
            const dataUrl = "data:application/json;base64,invalid";
            const fetchError = new Error("Invalid data URL");
            fetchStub.rejects(fetchError);

            const result = await utils.fetchTextWithBrowserFallback(dataUrl, runtimeStub, sessionId);

            assert.instanceOf(result, Error);
            assert.equal((result as Error).message, "Invalid data URL");
        });
    });

    describe("patchSourceMapSources", () => {
        it("should patch webpack protocol sources", () => {
            const sourceMap = {
                version: 3,
                sources: ["webpack://src/app.js", "webpack://src/utils.js", "regular/file.js"],
                sourceRoot: "",
                names: [],
                mappings: "",
                file: "bundle.js",
            };

            const result = utils.patchSourceMapSources(sourceMap, "/custom/root");

            assert.deepEqual(result.sources, ["src/app.js", "src/utils.js", "regular/file.js"]);
            assert.equal(result.sourceRoot, "/custom/root");
        });

        it("should use existing sourceRoot if no custom sourceRoot provided", () => {
            const sourceMap = {
                version: 3,
                sources: ["webpack:///src/app.js"],
                sourceRoot: "/existing/root",
                names: [],
                mappings: "",
                file: "bundle.js",
            };

            const result = utils.patchSourceMapSources(sourceMap);

            assert.equal(result.sourceRoot, "/existing/root");
        });

        it("should handle sources without webpack protocol", () => {
            const sourceMap = {
                version: 3,
                sources: ["src/app.js", "lib/utils.js"],
                sourceRoot: "",
                names: [],
                mappings: "",
                file: "bundle.js",
            };

            const result = utils.patchSourceMapSources(sourceMap, "/root");

            assert.deepEqual(result.sources, ["src/app.js", "lib/utils.js"]);
        });
    });

    describe("extractSourceFilesDeps", () => {
        let consumerMock: { originalPositionFor: SinonStub };

        beforeEach(() => {
            consumerMock = { originalPositionFor: sandbox.stub() };
            SourceMapConsumerStub.resolves(consumerMock);
        });

        it("should extract source files from coverage offsets", async () => {
            const source = "line1\nline2\nline3\nline4";
            const sourceMaps = JSON.stringify({
                version: 3,
                sources: ["src/app.js"],
                sourceRoot: "/root",
                names: [],
                mappings: "",
                file: "bundle.js",
            });
            const startOffsets = [0, 6, 12];

            consumerMock.originalPositionFor
                .onCall(0)
                .returns({ source: "src/app.js" })
                .onCall(1)
                .returns({ source: "src/utils.js" })
                .onCall(2)
                .returns({ source: null });

            const result = await utils.extractSourceFilesDeps(source, sourceMaps, startOffsets, "/root");

            assert.equal(result.size, 2);
            assert.isTrue(result.has("src/app.js"));
            assert.isTrue(result.has("src/utils.js"));
        });

        it("should handle empty start offsets", async () => {
            const source = "line1\nline2";
            const sourceMaps = JSON.stringify({
                version: 3,
                sources: ["src/app.js"],
                sourceRoot: "/root",
                names: [],
                mappings: "",
                file: "bundle.js",
            });

            const result = await utils.extractSourceFilesDeps(source, sourceMaps, [], "/root");

            assert.equal(result.size, 0);
        });
    });

    describe("hasProtocol", () => {
        it("should return true for URLs with protocol", () => {
            assert.isTrue(utils.hasProtocol("http://example.com"));
            assert.isTrue(utils.hasProtocol("https://example.com"));
            assert.isTrue(utils.hasProtocol("file:///path/to/file"));
            assert.isTrue(utils.hasProtocol("webpack://module"));
        });

        it("should return false for paths without protocol", () => {
            assert.isFalse(utils.hasProtocol("src/app.js"));
            assert.isFalse(utils.hasProtocol("/absolute/path"));
            assert.isFalse(utils.hasProtocol("relative/path"));
        });

        it("should return false for invalid URLs", () => {
            assert.isFalse(utils.hasProtocol("not-a-url:/"));
            assert.isFalse(utils.hasProtocol("://invalid"));
        });
    });

    describe("transformSourceDependencies", () => {
        beforeEach(() => {
            pathStub.posix.relative.callsFake((from, to) => to.replace(from + "/", ""));
            pathStub.posix.resolve.callsFake(path => path || "/current/dir");
        });

        it("should classify dependencies into css, js, and modules", () => {
            const cssDeps = ["src/styles.css", "../node_modules/lib/style.css"];
            const jsDeps = ["src/app.js", "node_modules/react/index.js"];

            fsStub.existsSync.returns(true);

            const result = utils.transformSourceDependencies(cssDeps, jsDeps);

            assert.deepEqual(result.css, ["src/styles.css"]);
            assert.deepEqual(result.js, ["src/app.js"]);
            assert.deepEqual(result.modules, ["node_modules/react", "../node_modules/lib"]);
        });

        it("should handle scoped packages", () => {
            const cssDeps: string[] = [];
            const jsDeps: string[] = ["node_modules/@scope/package/index.js"];

            fsStub.existsSync.returns(true);

            const result = utils.transformSourceDependencies(cssDeps, jsDeps);

            assert.deepEqual(result.modules, ["node_modules/@scope/package"]);
        });

        it("should throw error for unsupported protocols", () => {
            const cssDeps: string[] = ["ftp://example.com/style.css"];
            const jsDeps: string[] = [];

            assert.throws(() => {
                utils.transformSourceDependencies(cssDeps, jsDeps);
            }, /Selectivity: Found unsupported protocol/);
        });

        it("should throw error if dependency file doesn't exist", () => {
            const cssDeps: string[] = ["src/missing.css"];
            const jsDeps: string[] = [];

            fsStub.existsSync.returns(false);

            assert.throws(() => {
                utils.transformSourceDependencies(cssDeps, jsDeps);
            }, /Selectivity: Couldn't find/);
        });

        it("should decode URI components", () => {
            const cssDeps: string[] = ["src/file%20with%20spaces.css"];
            const jsDeps: string[] = [];

            softFileURLToPathStub.returns("src/file with spaces.css");
            pathStub.posix.relative.returns("src/file with spaces.css");
            fsStub.existsSync.returns(true);

            const result = utils.transformSourceDependencies(cssDeps, jsDeps);

            assert.calledWith(softFileURLToPathStub, "src/file%20with%20spaces.css");
            assert.deepEqual(result.css, ["src/file with spaces.css"]);
        });
    });

    describe("shallowSortObject", () => {
        it("should make result json have ordered properties", () => {
            const obj = {
                c: "3",
                a: "1",
                b: "2",
            };

            utils.shallowSortObject(obj);

            assert.equal(JSON.stringify(obj), '{"a":"1","b":"2","c":"3"}');
        });

        it("should sort object keys alphabetically", () => {
            const obj = {
                zebra: "value1",
                alpha: "value2",
                beta: "value3",
            };

            utils.shallowSortObject(obj);

            const keys = Object.keys(obj);
            assert.deepEqual(keys, ["alpha", "beta", "zebra"]);
        });

        it("should preserve values after sorting", () => {
            const obj = {
                c: { nested: "value3" },
                a: { nested: "value1" },
                b: { nested: "value2" },
            };

            utils.shallowSortObject(obj);

            assert.deepEqual(obj.a, { nested: "value1" });
            assert.deepEqual(obj.b, { nested: "value2" });
            assert.deepEqual(obj.c, { nested: "value3" });
        });

        it("should handle empty object", () => {
            const obj = {};

            utils.shallowSortObject(obj);

            assert.deepEqual(obj, {});
        });
    });
});
