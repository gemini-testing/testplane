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
            const cssDeps = new Set(["src/styles.css", "../node_modules/lib/style.css"]);
            const jsDeps = new Set(["src/app.js", "node_modules/react/index.js"]);

            fsStub.existsSync.returns(true);

            const result = utils.transformSourceDependencies(cssDeps, jsDeps);

            assert.deepEqual(result.css, ["src/styles.css"]);
            assert.deepEqual(result.js, ["src/app.js"]);
            assert.deepEqual(result.modules, ["../node_modules/lib", "node_modules/react"]);
        });

        it("should handle scoped packages", () => {
            const cssDeps = new Set<string>();
            const jsDeps = new Set(["node_modules/@scope/package/index.js"]);

            fsStub.existsSync.returns(true);

            const result = utils.transformSourceDependencies(cssDeps, jsDeps);

            assert.deepEqual(result.modules, ["node_modules/@scope/package"]);
        });

        it("should throw error if dependency file doesn't exist", () => {
            const cssDeps = new Set(["src/missing.css"]);
            const jsDeps = new Set<string>([]);

            fsStub.existsSync.returns(false);

            assert.throws(() => {
                utils.transformSourceDependencies(cssDeps, jsDeps);
            }, /Selectivity: Couldn't find/);
        });

        it("should decode URI components", () => {
            const cssDeps = new Set(["src/file%20with%20spaces.css"]);
            const jsDeps = new Set<string>();

            softFileURLToPathStub.returns("src/file with spaces.css");
            pathStub.posix.relative.returns("src/file with spaces.css");
            fsStub.existsSync.returns(true);

            const result = utils.transformSourceDependencies(cssDeps, jsDeps);

            assert.calledWith(softFileURLToPathStub, "src/file%20with%20spaces.css");
            assert.deepEqual(result.css, ["src/file with spaces.css"]);
        });

        it("should map dependencies using passed function", () => {
            const mapFn = (relativePath: string): string | void => {
                if (relativePath === "ignore") {
                    return;
                }

                if (relativePath === "../foo") {
                    return "../bar";
                }
            };

            const cssDeps = new Set<string>();
            const jsDeps = new Set<string>(["ignore", "../foo"]);

            fsStub.existsSync.returns(true);

            const result = utils.transformSourceDependencies(cssDeps, jsDeps, mapFn);

            assert.deepEqual(result.js, ["../bar"]);
        });
    });

    describe("mergeSourceDependencies", () => {
        it("should merge two empty dependency objects", () => {
            const a = { css: [], js: [], modules: [] };
            const b = { css: [], js: [], modules: [] };

            const result = utils.mergeSourceDependencies(a, b);

            assert.deepEqual(result, { css: [], js: [], modules: [] });
        });

        it("should merge when first object is empty", () => {
            const a = { css: [], js: [], modules: [] };
            const b = { css: ["style.css"], js: ["app.js"], modules: ["react"] };

            const result = utils.mergeSourceDependencies(a, b);

            assert.deepEqual(result, { css: ["style.css"], js: ["app.js"], modules: ["react"] });
        });

        it("should merge when second object is empty", () => {
            const a = { css: ["style.css"], js: ["app.js"], modules: ["react"] };
            const b = { css: [], js: [], modules: [] };

            const result = utils.mergeSourceDependencies(a, b);

            assert.deepEqual(result, { css: ["style.css"], js: ["app.js"], modules: ["react"] });
        });

        it("should merge sorted arrays maintaining order", () => {
            const a = { css: ["a.css", "c.css"], js: ["a.js", "c.js"], modules: ["lodash", "react"] };
            const b = { css: ["b.css", "d.css"], js: ["b.js", "d.js"], modules: ["axios", "vue"] };

            const result = utils.mergeSourceDependencies(a, b);

            assert.deepEqual(result, {
                css: ["a.css", "b.css", "c.css", "d.css"],
                js: ["a.js", "b.js", "c.js", "d.js"],
                modules: ["axios", "lodash", "react", "vue"],
            });
        });

        it("should remove duplicates when merging", () => {
            const a = {
                css: ["common.css", "unique-a.css"],
                js: ["common.js", "unique-a.js"],
                modules: ["react", "unique-a"],
            };
            const b = {
                css: ["common.css", "unique-b.css"],
                js: ["common.js", "unique-b.js"],
                modules: ["react", "unique-b"],
            };

            const result = utils.mergeSourceDependencies(a, b);

            assert.deepEqual(result, {
                css: ["common.css", "unique-a.css", "unique-b.css"],
                js: ["common.js", "unique-a.js", "unique-b.js"],
                modules: ["react", "unique-a", "unique-b"],
            });
        });

        it("should handle arrays with consecutive duplicates", () => {
            const a = { css: ["a.css", "a.css", "b.css"], js: ["a.js", "a.js"], modules: ["react", "react"] };
            const b = { css: ["a.css", "c.css", "c.css"], js: ["b.js", "b.js"], modules: ["vue", "vue"] };

            const result = utils.mergeSourceDependencies(a, b);

            assert.deepEqual(result, {
                css: ["a.css", "b.css", "c.css"],
                js: ["a.js", "b.js"],
                modules: ["react", "vue"],
            });
        });

        it("should handle mixed case sorting correctly", () => {
            const a = { css: ["A.css", "c.css"], js: ["A.js", "c.js"], modules: ["React", "lodash"] };
            const b = { css: ["B.css", "a.css"], js: ["B.js", "a.js"], modules: ["axios", "Vue"] };

            const result = utils.mergeSourceDependencies(a, b);

            assert.deepEqual(result, {
                css: ["A.css", "B.css", "a.css", "c.css"],
                js: ["A.js", "B.js", "a.js", "c.js"],
                modules: ["axios", "React", "lodash", "Vue"],
            });
        });

        it("should handle arrays of different lengths", () => {
            const a = { css: ["a.css"], js: ["a.js", "b.js", "c.js", "d.js"], modules: ["react"] };
            const b = { css: ["b.css", "c.css", "d.css"], js: ["e.js"], modules: ["axios", "lodash", "vue"] };

            const result = utils.mergeSourceDependencies(a, b);

            assert.deepEqual(result, {
                css: ["a.css", "b.css", "c.css", "d.css"],
                js: ["a.js", "b.js", "c.js", "d.js", "e.js"],
                modules: ["axios", "lodash", "react", "vue"],
            });
        });

        it("should handle identical arrays", () => {
            const a = { css: ["style.css"], js: ["app.js"], modules: ["react"] };
            const b = { css: ["style.css"], js: ["app.js"], modules: ["react"] };

            const result = utils.mergeSourceDependencies(a, b);

            assert.deepEqual(result, { css: ["style.css"], js: ["app.js"], modules: ["react"] });
        });

        it("should handle complex real-world scenario", () => {
            const a = {
                css: ["src/components/button.css", "src/styles/main.css"],
                js: ["src/components/button.js", "src/utils/helpers.js"],
                modules: ["@babel/core", "react", "webpack"],
            };
            const b = {
                css: ["src/components/modal.css", "src/styles/main.css"],
                js: ["src/components/modal.js", "src/utils/helpers.js"],
                modules: ["lodash", "react", "vue"],
            };

            const result = utils.mergeSourceDependencies(a, b);

            assert.deepEqual(result, {
                css: ["src/components/button.css", "src/components/modal.css", "src/styles/main.css"],
                js: ["src/components/button.js", "src/components/modal.js", "src/utils/helpers.js"],
                modules: ["@babel/core", "lodash", "react", "vue", "webpack"],
            });
        });

        it("should preserve original objects without mutation", () => {
            const a = { css: ["a.css"], js: ["a.js"], modules: ["react"] };
            const b = { css: ["b.css"], js: ["b.js"], modules: ["vue"] };
            const originalA = JSON.parse(JSON.stringify(a));
            const originalB = JSON.parse(JSON.stringify(b));

            utils.mergeSourceDependencies(a, b);

            assert.deepEqual(a, originalA);
            assert.deepEqual(b, originalB);
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

    describe("readHashFileContents", () => {
        let readJsonWithCompressionStub: SinonStub;
        let pathJoinStub: SinonStub;

        beforeEach(() => {
            readJsonWithCompressionStub = sandbox.stub();
            pathJoinStub = sandbox.stub().callsFake((...args) => args.join("/"));

            utils = proxyquire("src/browser/cdp/selectivity/utils", {
                fs: fsStub,
                path: { ...pathStub, join: pathJoinStub },
                "source-map": {
                    SourceMapConsumer: SourceMapConsumerStub,
                },
                "../../../utils/fs": {
                    softFileURLToPath: softFileURLToPathStub,
                },
                "./json-utils": {
                    readJsonWithCompression: readJsonWithCompressionStub,
                },
            });
        });

        it("should read hash file contents successfully", async () => {
            const mockHashContents = {
                files: { "src/app.js": "hash1" },
                modules: { "node_modules/react": "hash2" },
                patterns: { "src/**/*.js": "hash3" },
            };
            readJsonWithCompressionStub.resolves(mockHashContents);

            const result = await utils.readHashFileContents("/test/selectivity/hashes.json", "none");

            assert.deepEqual(result, mockHashContents);
            assert.calledWith(readJsonWithCompressionStub, "/test/selectivity/hashes.json", "none", {
                defaultValue: { files: {}, modules: {}, patterns: {} },
            });
        });

        it("should return default value when file read fails", async () => {
            readJsonWithCompressionStub.rejects(new Error("File not found"));

            const result = await utils.readHashFileContents("/test/selectivity/hashes.json", "gz");

            assert.deepEqual(result, { files: {}, modules: {}, patterns: {} });
        });

        it("should ensure all required properties exist", async () => {
            const incompleteHashContents = {
                files: { "src/app.js": "hash1" },
                // missing modules and patterns
            };
            readJsonWithCompressionStub.resolves(incompleteHashContents);

            const result = await utils.readHashFileContents("/test/selectivity/hashes.json", "br");

            assert.deepEqual(result, {
                files: { "src/app.js": "hash1" },
                modules: {},
                patterns: {},
            });
        });

        it("should handle null/undefined properties", async () => {
            const hashContentsWithNulls = {
                files: null,
                modules: undefined,
                patterns: { "src/**/*.js": "hash3" },
            };
            readJsonWithCompressionStub.resolves(hashContentsWithNulls);

            const result = await utils.readHashFileContents("/test/selectivity/hashes.json", "zstd");

            assert.deepEqual(result, {
                files: {},
                modules: {},
                patterns: { "src/**/*.js": "hash3" },
            });
        });
    });

    describe("readTestDependencies", () => {
        let readJsonWithCompressionStub: SinonStub;
        let pathJoinStub: SinonStub;

        beforeEach(() => {
            readJsonWithCompressionStub = sandbox.stub();
            pathJoinStub = sandbox.stub().callsFake((...args) => args.join("/"));

            utils = proxyquire("src/browser/cdp/selectivity/utils", {
                fs: fsStub,
                path: { ...pathStub, join: pathJoinStub },
                "source-map": {
                    SourceMapConsumer: SourceMapConsumerStub,
                },
                "../../../utils/fs": {
                    softFileURLToPath: softFileURLToPathStub,
                },
                "./json-utils": {
                    readJsonWithCompression: readJsonWithCompressionStub,
                },
            });
        });

        it("should read test dependencies successfully", async () => {
            const mockTest = {
                id: "test-123",
                title: "Test case",
                file: "test.js",
                location: { line: 1, column: 1 },
                fn: sandbox.stub(),
                clone: sandbox.stub(),
                assign: sandbox.stub(),
            } as any;
            const mockDependencies = {
                chrome: {
                    css: { css: ["src/styles.css"], js: [], modules: [] },
                    js: { css: [], js: ["src/app.js"], modules: ["react"] },
                },
            };
            readJsonWithCompressionStub.resolves(mockDependencies);

            const result = await utils.readTestDependencies("/test/selectivity/tests", mockTest, "none");

            assert.deepEqual(result, mockDependencies);
            assert.calledWith(readJsonWithCompressionStub, "/test/selectivity/tests/test-123.json", "none", {
                defaultValue: {},
            });
        });

        it("should return empty object when file read fails", async () => {
            const mockTest = {
                id: "test-456",
                title: "Another test",
                file: "test.js",
                location: { line: 1, column: 1 },
                fn: sandbox.stub(),
                clone: sandbox.stub(),
                assign: sandbox.stub(),
            } as any;
            readJsonWithCompressionStub.rejects(new Error("File not found"));

            const result = await utils.readTestDependencies("/test/selectivity/tests", mockTest, "gz");

            assert.deepEqual(result, {});
        });

        it("should handle different compression types", async () => {
            const mockTest = {
                id: "test-789",
                title: "Compressed test",
                file: "test.js",
                location: { line: 1, column: 1 },
                fn: sandbox.stub(),
                clone: sandbox.stub(),
                assign: sandbox.stub(),
            } as any;
            const mockDependencies = {
                firefox: {
                    css: { css: ["src/theme.css"], js: [], modules: [] },
                },
            };
            readJsonWithCompressionStub.resolves(mockDependencies);

            const result = await utils.readTestDependencies("/test/selectivity/tests", mockTest, "br");

            assert.deepEqual(result, mockDependencies);
            assert.calledWith(readJsonWithCompressionStub, "/test/selectivity/tests/test-789.json", "br", {
                defaultValue: {},
            });
        });

        it("should work with complex test dependencies structure", async () => {
            const mockTest = {
                id: "complex-test",
                title: "Complex test case",
                file: "test.js",
                location: { line: 1, column: 1 },
                fn: sandbox.stub(),
                clone: sandbox.stub(),
                assign: sandbox.stub(),
            } as any;
            const mockDependencies = {
                chrome: {
                    css: { css: ["src/styles.css", "src/components.css"], js: [], modules: ["styled-components"] },
                    js: { css: [], js: ["src/app.js", "src/utils.js"], modules: ["react", "lodash"] },
                },
                firefox: {
                    css: { css: ["src/styles.css"], js: [], modules: [] },
                    js: { css: [], js: ["src/app.js"], modules: ["react"] },
                },
            };
            readJsonWithCompressionStub.resolves(mockDependencies);

            const result = await utils.readTestDependencies("/test/selectivity/tests", mockTest, "zstd");

            assert.deepEqual(result, mockDependencies);
            assert.calledWith(readJsonWithCompressionStub, "/test/selectivity/tests/complex-test.json", "zstd", {
                defaultValue: {},
            });
        });
    });
});
