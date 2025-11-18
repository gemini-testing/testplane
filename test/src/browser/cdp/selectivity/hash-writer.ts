import sinon, { SinonStub } from "sinon";
import proxyquire from "proxyquire";

describe("CDP/Selectivity/HashWriter", () => {
    const sandbox = sinon.createSandbox();
    let HashWriter: any;
    let getHashWriter: typeof import("src/browser/cdp/selectivity/hash-writer").getHashWriter;
    let HashProviderStub: SinonStub;
    let pathStub: { join: SinonStub };
    let lockfileStub: { lock: SinonStub };
    let shallowSortObjectStub: SinonStub;
    let fileHashProviderMock: { calculateForFile: SinonStub };
    let readHashFileContentsStub: SinonStub;
    let writeJsonWithCompression: SinonStub;

    beforeEach(() => {
        fileHashProviderMock = { calculateForFile: sandbox.stub() };
        HashProviderStub = sandbox.stub().returns(fileHashProviderMock);
        pathStub = {
            join: sandbox.stub().callsFake((...args) => args.join("/")),
        };
        lockfileStub = { lock: sandbox.stub().resolves(sandbox.stub()) };
        shallowSortObjectStub = sandbox.stub();
        readHashFileContentsStub = sandbox.stub().resolves({});
        writeJsonWithCompression = sandbox.stub().resolves();

        const proxyquiredModule = proxyquire("src/browser/cdp/selectivity/hash-writer", {
            "node:path": pathStub,
            "proper-lockfile": lockfileStub,
            "./hash-provider": { HashProvider: HashProviderStub },
            "./utils": { shallowSortObject: shallowSortObjectStub, readHashFileContents: readHashFileContentsStub },
            "./json-utils": { writeJsonWithCompression },
        });

        HashWriter = proxyquiredModule.HashWriter || proxyquiredModule.default;
        getHashWriter = proxyquiredModule.getHashWriter;
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("add", () => {
        it("should add file and module dependencies", () => {
            const writer = new HashWriter("/test/selectivity", "none");
            const dependencies = {
                css: ["src/styles.css", "src/theme.css"],
                js: ["src/app.js", "src/utils.js"],
                modules: ["node_modules/react", "node_modules/lodash"],
            };

            fileHashProviderMock.calculateForFile.returns(Promise.resolve("hash123"));

            writer.addTestDependencyHashes(dependencies);

            assert.calledWith(fileHashProviderMock.calculateForFile, "src/styles.css");
            assert.calledWith(fileHashProviderMock.calculateForFile, "src/theme.css");
            assert.calledWith(fileHashProviderMock.calculateForFile, "src/app.js");
            assert.calledWith(fileHashProviderMock.calculateForFile, "src/utils.js");
            assert.calledWith(fileHashProviderMock.calculateForFile, "node_modules/react/package.json");
            assert.calledWith(fileHashProviderMock.calculateForFile, "node_modules/lodash/package.json");
        });

        it("should not add duplicate dependencies", () => {
            const writer = new HashWriter("/test/selectivity", "none");
            const dependencies = {
                css: ["src/styles.css"],
                js: ["src/app.js"],
                modules: ["node_modules/react"],
            };

            fileHashProviderMock.calculateForFile.returns(Promise.resolve("hash123"));

            writer.addTestDependencyHashes(dependencies);
            writer.addTestDependencyHashes(dependencies);

            assert.calledOnce(fileHashProviderMock.calculateForFile.withArgs("src/styles.css"));
            assert.calledOnce(fileHashProviderMock.calculateForFile.withArgs("src/app.js"));
            assert.calledOnce(fileHashProviderMock.calculateForFile.withArgs("node_modules/react/package.json"));
        });

        it("should handle empty dependencies", () => {
            const writer = new HashWriter("/test/selectivity", "none");
            const dependencies = {
                css: [],
                js: [],
                modules: [],
            };

            fileHashProviderMock.calculateForFile.returns(Promise.resolve("hash123"));

            writer.addTestDependencyHashes(dependencies);

            assert.notCalled(fileHashProviderMock.calculateForFile);
        });
    });

    describe("commit", () => {
        it("should not commit if not initialized", async () => {
            const writer = new HashWriter("/test/selectivity", "none");

            await writer.commit();

            assert.notCalled(writeJsonWithCompression);
        });

        it("should not commit if no staged dependencies", async () => {
            const defaultValue = { files: {}, modules: {}, patterns: {} };
            const writer = new HashWriter("/test/selectivity", "none");

            readHashFileContentsStub.resolves(defaultValue);
            writer.addTestDependencyHashes({ css: [], js: [], modules: [] });

            await writer.commit();

            assert.notCalled(writeJsonWithCompression);
        });

        it("should create new hash file if it doesn't exist", async () => {
            const defaultValue = { files: {}, modules: {}, patterns: {} };
            const writer = new HashWriter("/test/selectivity", "none");
            const dependencies = {
                css: ["src/styles.css"],
                js: ["src/app.js"],
                modules: ["node_modules/react"],
            };

            readHashFileContentsStub.resolves(defaultValue);
            fileHashProviderMock.calculateForFile
                .withArgs("src/styles.css")
                .resolves("css-hash")
                .withArgs("src/app.js")
                .resolves("js-hash")
                .withArgs("node_modules/react/package.json")
                .resolves("module-hash");

            writer.addTestDependencyHashes(dependencies);
            await writer.commit();

            assert.calledWith(writeJsonWithCompression, "/test/selectivity/hashes.json", {
                files: {
                    "src/styles.css": "css-hash",
                    "src/app.js": "js-hash",
                },
                modules: {
                    "node_modules/react": "module-hash",
                },
                patterns: {},
            });
        });

        it("should update existing hash file", async () => {
            const writer = new HashWriter("/test/selectivity", "none");
            const dependencies = {
                css: ["src/new-styles.css"],
                js: ["src/new-app.js"],
                modules: ["node_modules/new-lib"],
            };

            const existingContent = {
                files: { "src/old-file.js": "old-hash" },
                modules: { "node_modules/old-lib": "old-module-hash" },
                patterns: {},
            };

            readHashFileContentsStub.resolves(existingContent);
            fileHashProviderMock.calculateForFile
                .withArgs("src/new-styles.css")
                .resolves("new-css-hash")
                .withArgs("src/new-app.js")
                .resolves("new-js-hash")
                .withArgs("node_modules/new-lib/package.json")
                .resolves("new-module-hash");

            writer.addTestDependencyHashes(dependencies);
            await writer.commit();

            assert.calledWith(writeJsonWithCompression, "/test/selectivity/hashes.json", {
                files: {
                    "src/old-file.js": "old-hash",
                    "src/new-styles.css": "new-css-hash",
                    "src/new-app.js": "new-js-hash",
                },
                modules: {
                    "node_modules/old-lib": "old-module-hash",
                    "node_modules/new-lib": "new-module-hash",
                },
                patterns: {},
            });
        });

        it("should not update files with same hash", async () => {
            const writer = new HashWriter("/test/selectivity", "none");
            const dependencies = {
                css: ["src/styles.css"],
                js: [],
                modules: [],
            };

            const existingContent = {
                files: { "src/styles.css": "same-hash" },
                modules: {},
                patterns: {},
            };

            readHashFileContentsStub.resolves(existingContent);
            fileHashProviderMock.calculateForFile.withArgs("src/styles.css").resolves("same-hash");

            writer.addTestDependencyHashes(dependencies);
            await writer.commit();

            // Should not write to file since hash is the same
            assert.notCalled(writeJsonWithCompression);
        });

        it("should handle hash calculation errors", async () => {
            const defaultValue = { files: {}, modules: {}, patterns: {} };
            const writer = new HashWriter("/test/selectivity", "none");
            const dependencies = {
                css: ["src/styles.css"],
                js: [],
                modules: [],
            };

            const error = new Error("File not found");
            readHashFileContentsStub.resolves(defaultValue);
            fileHashProviderMock.calculateForFile.withArgs("src/styles.css").rejects(error);

            writer.addTestDependencyHashes(dependencies);

            await assert.isRejected(writer.commit(), "File not found");
        });

        it("should sort objects after updating", async () => {
            const defaultValue = { files: {}, modules: {}, patterns: {} };
            const writer = new HashWriter("/test/selectivity", "none");
            const dependencies = {
                css: ["src/styles.css"],
                js: [],
                modules: ["node_modules/react"],
            };

            readHashFileContentsStub.resolves(defaultValue);
            fileHashProviderMock.calculateForFile
                .withArgs("src/styles.css")
                .resolves("css-hash")
                .withArgs("node_modules/react/package.json")
                .resolves("module-hash");

            writer.addTestDependencyHashes(dependencies);
            await writer.commit();

            assert.calledTwice(shallowSortObjectStub);
        });
    });

    describe("getHashWriter", () => {
        it("should return memoized instance", () => {
            const path1 = "/test/path1";
            const path2 = "/test/path2";

            const writer1a = getHashWriter(path1, "none");
            const writer1b = getHashWriter(path1, "none");
            const writer2 = getHashWriter(path2, "none");

            assert.equal(writer1a, writer1b);
            assert.notEqual(writer1a, writer2);
        });
    });
});
