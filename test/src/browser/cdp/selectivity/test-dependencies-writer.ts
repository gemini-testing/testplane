import sinon, { SinonStub } from "sinon";
import proxyquire from "proxyquire";

describe("CDP/Selectivity/TestDependenciesWriter", () => {
    const sandbox = sinon.createSandbox();
    let TestDependenciesWriter: any;
    let getTestDependenciesWriter: typeof import("src/browser/cdp/selectivity/test-dependencies-writer").getTestDependenciesWriter;
    let fsExtraStub: { ensureDir: SinonStub };
    let pathStub: { join: SinonStub };
    let lockfileStub: { lock: SinonStub };
    let shallowSortObjectStub: SinonStub;
    let readTestDependenciesStub: SinonStub;
    let writeJsonWithCompression: SinonStub;

    beforeEach(() => {
        fsExtraStub = {
            ensureDir: sandbox.stub().resolves(),
        };
        pathStub = {
            join: sandbox.stub().callsFake((...args) => args.join("/")),
        };
        lockfileStub = { lock: sandbox.stub().resolves(sandbox.stub()) };
        shallowSortObjectStub = sandbox.stub();
        readTestDependenciesStub = sandbox.stub().resolves({});
        writeJsonWithCompression = sandbox.stub().resolves();

        const proxyquiredModule = proxyquire("src/browser/cdp/selectivity/test-dependencies-writer", {
            "node:path": pathStub,
            "proper-lockfile": lockfileStub,
            "fs-extra": fsExtraStub,
            "./utils": { shallowSortObject: shallowSortObjectStub, readTestDependencies: readTestDependenciesStub },
            "./json-utils": { writeJsonWithCompression },
        });

        TestDependenciesWriter = proxyquiredModule.TestDependenciesWriter;
        getTestDependenciesWriter = proxyquiredModule.getTestDependenciesWriter;
    });

    afterEach(() => {
        sandbox.restore();
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
        const mockEmptyDependencies = {
            css: [],
            js: [],
            modules: [],
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
            readTestDependenciesStub.resolves({});

            await writer.saveFor(mockTest, mockDependencies, mockEmptyDependencies);

            const expectedPath = "/test/selectivity/tests/test-123.json";
            const expectedContent = { chrome: { browser: mockDependencies, testplane: mockEmptyDependencies } };

            assert.calledWith(writeJsonWithCompression, expectedPath, expectedContent);
            assert.calledOnce(shallowSortObjectStub);
        });

        it("should update existing test dependencies", async () => {
            const writer = new TestDependenciesWriter("/test/selectivity", "none");
            const existingContent = {
                firefox: { browser: { css: ["old.css"], js: [], modules: [] } },
            };

            readTestDependenciesStub.resolves(existingContent);

            await writer.saveFor(mockTest, mockDependencies, mockEmptyDependencies);

            const expectedContent = {
                firefox: { browser: { css: ["old.css"], js: [], modules: [] } },
                chrome: { browser: mockDependencies, testplane: mockEmptyDependencies },
            };

            assert.calledWith(writeJsonWithCompression, "/test/selectivity/tests/test-123.json", expectedContent);
        });

        it("should not save if dependencies are the same", async () => {
            const writer = new TestDependenciesWriter("/test/selectivity", "none");
            const existingContent = {
                chrome: { browser: mockDependencies, testplane: mockEmptyDependencies },
            };

            readTestDependenciesStub.resolves(existingContent);

            await writer.saveFor(mockTest, mockDependencies, mockEmptyDependencies);

            assert.notCalled(writeJsonWithCompression);
        });

        it("should handle empty file", async () => {
            const writer = new TestDependenciesWriter("/test/selectivity", "none");
            readTestDependenciesStub.resolves({});

            await writer.saveFor(mockTest, mockDependencies, mockEmptyDependencies);

            const expectedContent = { chrome: { browser: mockDependencies, testplane: mockEmptyDependencies } };

            assert.calledWith(writeJsonWithCompression, "/test/selectivity/tests/test-123.json", expectedContent);
        });

        it("should overwrite existing browser dependencies", async () => {
            const writer = new TestDependenciesWriter("/test/selectivity", "none");
            const existingContent = {
                chrome: { browser: { css: ["old.css"], js: [], modules: [] }, testplane: mockEmptyDependencies },
            };

            readTestDependenciesStub.resolves(existingContent);

            await writer.saveFor(mockTest, mockDependencies, mockEmptyDependencies);

            const expectedContent = { chrome: { browser: mockDependencies, testplane: mockEmptyDependencies } };

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
            const existingContent = { chrome: { browser: deps1, testplane: deps1 } };

            readTestDependenciesStub.resolves(existingContent);

            return writer.saveFor({ id: "test", browserId: "chrome" }, deps2, deps2).then(() => {
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
            const existingContent = { chrome: { browser: deps1, testplane: deps2 } };

            readTestDependenciesStub.resolves(existingContent);

            await writer.saveFor({ id: "test", browserId: "chrome" }, deps2, deps2);

            assert.calledOnce(writeJsonWithCompression);
        });

        it("should return false for undefined dependencies", async () => {
            const deps = {
                css: ["a.css"],
                js: ["a.js"],
                modules: ["react"],
            };

            const writer = new TestDependenciesWriter("/test/selectivity", "none");
            readTestDependenciesStub.resolves({});

            await writer.saveFor({ id: "test", browserId: "chrome" }, deps, deps);

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
            const existingContent = { chrome: { browser: deps1, testplane: deps1 } };

            readTestDependenciesStub.resolves(existingContent);

            await writer.saveFor({ id: "test", browserId: "chrome" }, deps2, deps2);

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
