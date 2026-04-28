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
                png: [],
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

        it("should add png dependencies as file dependencies", () => {
            const writer = new HashWriter("/test/selectivity", "none");
            const dependencies = {
                css: [],
                js: [],
                modules: [],
                png: ["screenshots/ref1.png", "screenshots/ref2.png"],
            };

            fileHashProviderMock.calculateForFile.returns(Promise.resolve("hash123"));

            writer.addTestDependencyHashes(dependencies);

            assert.calledWith(fileHashProviderMock.calculateForFile, "screenshots/ref1.png");
            assert.calledWith(fileHashProviderMock.calculateForFile, "screenshots/ref2.png");
        });

        it("should not add duplicate dependencies", () => {
            const writer = new HashWriter("/test/selectivity", "none");
            const dependencies = {
                css: ["src/styles.css"],
                js: ["src/app.js"],
                modules: ["node_modules/react"],
                png: [],
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
                png: [],
            };

            fileHashProviderMock.calculateForFile.returns(Promise.resolve("hash123"));

            writer.addTestDependencyHashes(dependencies);

            assert.notCalled(fileHashProviderMock.calculateForFile);
        });
    });

    describe("save", () => {
        it("should not save if not initialized", async () => {
            const writer = new HashWriter("/test/selectivity", "none");

            await writer.save();

            assert.notCalled(writeJsonWithCompression);
        });

        it("should not save if no staged dependencies", async () => {
            const defaultValue = { files: {}, modules: {}, patterns: {} };
            const writer = new HashWriter("/test/selectivity", "none");

            readHashFileContentsStub.resolves(defaultValue);
            writer.addTestDependencyHashes({ css: [], js: [], modules: [], png: [] });

            await writer.save();

            assert.notCalled(writeJsonWithCompression);
        });

        it("should create new hash file if it doesn't exist", async () => {
            const defaultValue = { files: {}, modules: {}, patterns: {} };
            const writer = new HashWriter("/test/selectivity", "none");
            const dependencies = {
                css: ["src/styles.css"],
                js: ["src/app.js"],
                modules: ["node_modules/react"],
                png: [],
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
            await writer.save();

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

        it("should handle hash calculation errors", async () => {
            const defaultValue = { files: {}, modules: {}, patterns: {} };
            const writer = new HashWriter("/test/selectivity", "none");
            const dependencies = {
                css: ["src/styles.css"],
                js: [],
                modules: [],
                png: [],
            };

            const error = new Error("File not found");
            readHashFileContentsStub.resolves(defaultValue);
            fileHashProviderMock.calculateForFile.withArgs("src/styles.css").rejects(error);

            writer.addTestDependencyHashes(dependencies);

            await assert.isRejected(writer.save(), "File not found");
        });

        it("should save png dependency hashes to files section", async () => {
            const defaultValue = { files: {}, modules: {}, patterns: {} };
            const writer = new HashWriter("/test/selectivity", "none");
            const dependencies = {
                css: [],
                js: [],
                modules: [],
                png: ["screenshots/ref.png"],
            };

            readHashFileContentsStub.resolves(defaultValue);
            fileHashProviderMock.calculateForFile.withArgs("screenshots/ref.png").resolves("png-hash");

            writer.addTestDependencyHashes(dependencies);
            await writer.save();

            assert.calledWith(writeJsonWithCompression, "/test/selectivity/hashes.json", {
                files: {
                    "screenshots/ref.png": "png-hash",
                },
                modules: {},
                patterns: {},
            });
        });

        it("should merge staged hashes with existing file contents", async () => {
            const existingContents = {
                files: { "src/old.css": "old-hash" },
                modules: { "node_modules/old-module": "old-module-hash" },
                patterns: { "*.old": "old-pattern-hash" },
            };
            const writer = new HashWriter("/test/selectivity", "none");
            const dependencies = {
                css: ["src/styles.css"],
                js: ["src/app.js"],
                modules: ["node_modules/react"],
                png: [],
            };

            readHashFileContentsStub.resolves(existingContents);
            fileHashProviderMock.calculateForFile
                .withArgs("src/styles.css")
                .resolves("css-hash")
                .withArgs("src/app.js")
                .resolves("js-hash")
                .withArgs("node_modules/react/package.json")
                .resolves("module-hash");

            writer.addTestDependencyHashes(dependencies);
            await writer.save();

            assert.calledWith(writeJsonWithCompression, "/test/selectivity/hashes.json", {
                files: {
                    "src/old.css": "old-hash",
                    "src/styles.css": "css-hash",
                    "src/app.js": "js-hash",
                },
                modules: {
                    "node_modules/old-module": "old-module-hash",
                    "node_modules/react": "module-hash",
                },
                patterns: { "*.old": "old-pattern-hash" },
            });
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
