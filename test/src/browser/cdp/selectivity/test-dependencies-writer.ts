import sinon, { SinonStub } from "sinon";
import proxyquire from "proxyquire";

describe("CDP/Selectivity/TestDependenciesWriter", () => {
    const sandbox = sinon.createSandbox();
    let TestDependenciesWriter: any;
    let getTestDependenciesWriter: typeof import("src/browser/cdp/selectivity/test-dependencies-writer").getTestDependenciesWriter;
    let fsExtraStub: { ensureDir: SinonStub };
    let pathStub: { join: SinonStub };
    let shallowSortObjectStub: SinonStub;
    let readJsonWithCompression: SinonStub;
    let writeJsonWithCompression: SinonStub;

    beforeEach(() => {
        fsExtraStub = {
            ensureDir: sandbox.stub().resolves(),
        };
        pathStub = {
            join: sandbox.stub().callsFake((...args) => args.join("/")),
        };
        shallowSortObjectStub = sandbox.stub();
        readJsonWithCompression = sandbox.stub().resolves({});
        writeJsonWithCompression = sandbox.stub().resolves();

        const proxyquiredModule = proxyquire("src/browser/cdp/selectivity/test-dependencies-writer", {
            "node:path": pathStub,
            "fs-extra": fsExtraStub,
            "./utils": { shallowSortObject: shallowSortObjectStub },
            "./json-utils": { readJsonWithCompression, writeJsonWithCompression },
        });

        TestDependenciesWriter = proxyquiredModule.TestDependenciesWriter;
        getTestDependenciesWriter = proxyquiredModule.getTestDependenciesWriter;
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("constructor", () => {
        it("should initialize with correct paths", () => {
            const selectivityRootPath = "/test/selectivity";
            new TestDependenciesWriter(selectivityRootPath, "none");

            assert.calledWith(pathStub.join, selectivityRootPath, "tests");
        });
    });

    describe("saveFor", () => {
        const mockTest = {
            id: "test-123",
            browserId: "chrome",
        };

        const mockDependencies = {
            css: ["src/styles.css"],
            js: ["src/app.js"],
            modules: ["node_modules/react"],
        };

        it("should create directory on first save", async () => {
            const writer = new TestDependenciesWriter("/test/selectivity", "none");

            await writer.saveFor(mockTest, mockDependencies);

            assert.calledOnceWith(fsExtraStub.ensureDir, "/test/selectivity/tests");
        });

        it("should not create directory on subsequent saves", async () => {
            const writer = new TestDependenciesWriter("/test/selectivity", "none");

            await writer.saveFor(mockTest, mockDependencies);
            await writer.saveFor(mockTest, mockDependencies);

            assert.calledOnce(fsExtraStub.ensureDir);
        });

        it("should save new test dependencies", async () => {
            const writer = new TestDependenciesWriter("/test/selectivity", "none");
            readJsonWithCompression.resolves({});

            await writer.saveFor(mockTest, mockDependencies);

            const expectedPath = "/test/selectivity/tests/test-123.json";
            const expectedContent = { chrome: { browser: mockDependencies } };

            assert.calledWith(pathStub.join, "/test/selectivity/tests", "test-123.json");
            assert.calledWith(writeJsonWithCompression, expectedPath, expectedContent);
            assert.calledOnce(shallowSortObjectStub);
        });

        it("should update existing test dependencies", async () => {
            const writer = new TestDependenciesWriter("/test/selectivity", "none");
            const existingContent = {
                firefox: { browser: { css: ["old.css"], js: [], modules: [] } },
            };

            readJsonWithCompression.resolves(existingContent);

            await writer.saveFor(mockTest, mockDependencies);

            const expectedContent = {
                firefox: { browser: { css: ["old.css"], js: [], modules: [] } },
                chrome: { browser: mockDependencies },
            };

            assert.calledWith(writeJsonWithCompression, "/test/selectivity/tests/test-123.json", expectedContent);
        });

        it("should not save if dependencies are the same", async () => {
            const writer = new TestDependenciesWriter("/test/selectivity", "none");
            const existingContent = {
                chrome: { browser: mockDependencies },
            };

            readJsonWithCompression.resolves(existingContent);

            await writer.saveFor(mockTest, mockDependencies);

            assert.notCalled(writeJsonWithCompression);
        });

        it("should handle corrupted JSON file", async () => {
            const writer = new TestDependenciesWriter("/test/selectivity", "none");
            readJsonWithCompression.rejects(new Error("invalid json"));

            await writer.saveFor(mockTest, mockDependencies);

            const expectedContent = { chrome: { browser: mockDependencies } };

            assert.calledWith(writeJsonWithCompression, "/test/selectivity/tests/test-123.json", expectedContent);
        });

        it("should handle empty file", async () => {
            const writer = new TestDependenciesWriter("/test/selectivity", "none");
            readJsonWithCompression.resolves({});

            await writer.saveFor(mockTest, mockDependencies);

            const expectedContent = { chrome: { browser: mockDependencies } };

            assert.calledWith(writeJsonWithCompression, "/test/selectivity/tests/test-123.json", expectedContent);
        });

        it("should overwrite existing browser dependencies", async () => {
            const writer = new TestDependenciesWriter("/test/selectivity", "none");
            const existingContent = {
                chrome: { browser: { css: ["old.css"], js: [], modules: [] } },
            };

            readJsonWithCompression.resolves(existingContent);

            await writer.saveFor(mockTest, mockDependencies);

            const expectedContent = { chrome: { browser: mockDependencies } };

            assert.calledWith(writeJsonWithCompression, "/test/selectivity/tests/test-123.json", expectedContent);
        });
    });

    describe("areDepsSame", () => {
        it("should return true for identical dependencies", () => {
            const deps1 = {
                css: ["a.css", "b.css"],
                js: ["a.js", "b.js"],
                modules: ["react", "lodash"],
            };
            const deps2 = {
                css: ["a.css", "b.css"],
                js: ["a.js", "b.js"],
                modules: ["react", "lodash"],
            };

            const writer = new TestDependenciesWriter("/test/selectivity", "none");
            const existingContent = { chrome: { browser: deps1 } };

            readJsonWithCompression.resolves(existingContent);

            return writer.saveFor({ id: "test", browserId: "chrome" }, deps2).then(() => {
                assert.notCalled(writeJsonWithCompression);
            });
        });

        it("should return false for different dependencies", async () => {
            const deps1 = {
                css: ["a.css"],
                js: ["a.js"],
                modules: ["react"],
            };
            const deps2 = {
                css: ["b.css"],
                js: ["b.js"],
                modules: ["lodash"],
            };

            const writer = new TestDependenciesWriter("/test/selectivity", "none");
            const existingContent = { chrome: { browser: deps1 } };

            readJsonWithCompression.resolves(existingContent);

            await writer.saveFor({ id: "test", browserId: "chrome" }, deps2);

            assert.calledOnce(writeJsonWithCompression);
        });

        it("should return false for undefined dependencies", async () => {
            const deps = {
                css: ["a.css"],
                js: ["a.js"],
                modules: ["react"],
            };

            const writer = new TestDependenciesWriter("/test/selectivity", "none");
            readJsonWithCompression.resolves({});

            await writer.saveFor({ id: "test", browserId: "chrome" }, deps);

            assert.calledOnce(writeJsonWithCompression);
        });

        it("should return false for different array lengths", async () => {
            const deps1 = {
                css: ["a.css"],
                js: ["a.js"],
                modules: ["react"],
            };
            const deps2 = {
                css: ["a.css", "b.css"],
                js: ["a.js"],
                modules: ["react"],
            };

            const writer = new TestDependenciesWriter("/test/selectivity", "none");
            const existingContent = { chrome: { browser: deps1 } };

            readJsonWithCompression.resolves(existingContent);

            await writer.saveFor({ id: "test", browserId: "chrome" }, deps2);

            assert.calledOnce(writeJsonWithCompression);
        });
    });

    describe("getTestDependenciesWriter", () => {
        it("should return memoized instance", () => {
            const path1 = "/test/path1";
            const path2 = "/test/path2";

            const writer1a = getTestDependenciesWriter(path1, "none");
            const writer1b = getTestDependenciesWriter(path1, "none");
            const writer2 = getTestDependenciesWriter(path2, "none");

            assert.equal(writer1a, writer1b);
            assert.notEqual(writer1a, writer2);
        });
    });
});
