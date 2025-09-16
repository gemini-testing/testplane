import sinon, { SinonStub } from "sinon";
import proxyquire from "proxyquire";

describe("CDP/Selectivity/FileHashWriter", () => {
    const sandbox = sinon.createSandbox();
    let FileHashWriter: any;
    let getFileHashWriter: typeof import("src/browser/cdp/selectivity/file-hash-writer").getFileHashWriter;
    let FileHashProviderStub: SinonStub;
    let fsExtraStub: { exists: SinonStub; readFile: SinonStub; outputJSON: SinonStub };
    let pathStub: { join: SinonStub };
    let shallowSortObjectStub: SinonStub;
    let fileHashProviderMock: { calculateFor: SinonStub };

    beforeEach(() => {
        fileHashProviderMock = { calculateFor: sandbox.stub() };
        FileHashProviderStub = sandbox.stub().returns(fileHashProviderMock);
        fsExtraStub = {
            exists: sandbox.stub().resolves(false),
            readFile: sandbox.stub().resolves("{}"),
            outputJSON: sandbox.stub().resolves(),
        };
        pathStub = {
            join: sandbox.stub().callsFake((...args) => args.join("/")),
        };
        shallowSortObjectStub = sandbox.stub();

        const proxyquiredModule = proxyquire("src/browser/cdp/selectivity/file-hash-writer", {
            "node:path": pathStub,
            "fs-extra": fsExtraStub,
            "./file-hash-provider": { FileHashProvider: FileHashProviderStub },
            "./utils": { shallowSortObject: shallowSortObjectStub },
        });

        FileHashWriter = proxyquiredModule.FileHashWriter || proxyquiredModule.default;
        getFileHashWriter = proxyquiredModule.getFileHashWriter;
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("constructor", () => {
        it("should initialize with correct paths", () => {
            const selectivityRootPath = "/test/selectivity";
            new FileHashWriter(selectivityRootPath);

            assert.calledWith(pathStub.join, selectivityRootPath, "hashes.json");
        });
    });

    describe("add", () => {
        it("should add file and module dependencies", () => {
            const writer = new FileHashWriter("/test/selectivity");
            const dependencies = {
                css: ["src/styles.css", "src/theme.css"],
                js: ["src/app.js", "src/utils.js"],
                modules: ["node_modules/react", "node_modules/lodash"],
            };

            fileHashProviderMock.calculateFor.returns(Promise.resolve("hash123"));

            writer.add(dependencies);

            assert.calledWith(fileHashProviderMock.calculateFor, "src/styles.css");
            assert.calledWith(fileHashProviderMock.calculateFor, "src/theme.css");
            assert.calledWith(fileHashProviderMock.calculateFor, "src/app.js");
            assert.calledWith(fileHashProviderMock.calculateFor, "src/utils.js");
            assert.calledWith(fileHashProviderMock.calculateFor, "node_modules/react/package.json");
            assert.calledWith(fileHashProviderMock.calculateFor, "node_modules/lodash/package.json");
        });

        it("should not add duplicate dependencies", () => {
            const writer = new FileHashWriter("/test/selectivity");
            const dependencies = {
                css: ["src/styles.css"],
                js: ["src/app.js"],
                modules: ["node_modules/react"],
            };

            fileHashProviderMock.calculateFor.returns(Promise.resolve("hash123"));

            writer.add(dependencies);
            writer.add(dependencies);

            assert.calledOnce(fileHashProviderMock.calculateFor.withArgs("src/styles.css"));
            assert.calledOnce(fileHashProviderMock.calculateFor.withArgs("src/app.js"));
            assert.calledOnce(fileHashProviderMock.calculateFor.withArgs("node_modules/react/package.json"));
        });

        it("should handle empty dependencies", () => {
            const writer = new FileHashWriter("/test/selectivity");
            const dependencies = {
                css: [],
                js: [],
                modules: [],
            };

            fileHashProviderMock.calculateFor.returns(Promise.resolve("hash123"));

            writer.add(dependencies);

            assert.notCalled(fileHashProviderMock.calculateFor);
        });
    });

    describe("commit", () => {
        it("should not commit if not initialized", async () => {
            const writer = new FileHashWriter("/test/selectivity");

            await writer.commit();

            assert.notCalled(fsExtraStub.outputJSON);
        });

        it("should not commit if no staged dependencies", async () => {
            const writer = new FileHashWriter("/test/selectivity");

            fsExtraStub.exists.resolves(false);
            writer.add({ css: [], js: [], modules: [] });

            await writer.commit();

            assert.notCalled(fsExtraStub.outputJSON);
        });

        it("should create new hash file if it doesn't exist", async () => {
            const writer = new FileHashWriter("/test/selectivity");
            const dependencies = {
                css: ["src/styles.css"],
                js: ["src/app.js"],
                modules: ["node_modules/react"],
            };

            fsExtraStub.exists.resolves(false);
            fileHashProviderMock.calculateFor
                .withArgs("src/styles.css")
                .resolves("css-hash")
                .withArgs("src/app.js")
                .resolves("js-hash")
                .withArgs("node_modules/react/package.json")
                .resolves("module-hash");

            writer.add(dependencies);
            await writer.commit();

            assert.calledWith(
                fsExtraStub.outputJSON,
                "/test/selectivity/hashes.json",
                {
                    files: {
                        "src/styles.css": "css-hash",
                        "src/app.js": "js-hash",
                    },
                    modules: {
                        "node_modules/react": "module-hash",
                    },
                },
                { spaces: 2 },
            );
        });

        it("should update existing hash file", async () => {
            const writer = new FileHashWriter("/test/selectivity");
            const dependencies = {
                css: ["src/new-styles.css"],
                js: ["src/new-app.js"],
                modules: ["node_modules/new-lib"],
            };

            const existingContent = JSON.stringify({
                files: { "src/old-file.js": "old-hash" },
                modules: { "node_modules/old-lib": "old-module-hash" },
            });

            fsExtraStub.exists.resolves(true);
            fsExtraStub.readFile.resolves(existingContent);
            fileHashProviderMock.calculateFor
                .withArgs("src/new-styles.css")
                .resolves("new-css-hash")
                .withArgs("src/new-app.js")
                .resolves("new-js-hash")
                .withArgs("node_modules/new-lib/package.json")
                .resolves("new-module-hash");

            writer.add(dependencies);
            await writer.commit();

            assert.calledWith(
                fsExtraStub.outputJSON,
                "/test/selectivity/hashes.json",
                {
                    files: {
                        "src/old-file.js": "old-hash",
                        "src/new-styles.css": "new-css-hash",
                        "src/new-app.js": "new-js-hash",
                    },
                    modules: {
                        "node_modules/old-lib": "old-module-hash",
                        "node_modules/new-lib": "new-module-hash",
                    },
                },
                { spaces: 2 },
            );
        });

        it("should not update files with same hash", async () => {
            const writer = new FileHashWriter("/test/selectivity");
            const dependencies = {
                css: ["src/styles.css"],
                js: [],
                modules: [],
            };

            const existingContent = JSON.stringify({
                files: { "src/styles.css": "same-hash" },
                modules: {},
            });

            fsExtraStub.exists.resolves(true);
            fsExtraStub.readFile.resolves(existingContent);
            fileHashProviderMock.calculateFor.withArgs("src/styles.css").resolves("same-hash");

            writer.add(dependencies);
            await writer.commit();

            // Should not write to file since hash is the same
            assert.notCalled(fsExtraStub.outputJSON);
        });

        it("should handle hash calculation errors", async () => {
            const writer = new FileHashWriter("/test/selectivity");
            const dependencies = {
                css: ["src/styles.css"],
                js: [],
                modules: [],
            };

            const error = new Error("File not found");
            fsExtraStub.exists.resolves(false);
            fileHashProviderMock.calculateFor.withArgs("src/styles.css").rejects(error);

            writer.add(dependencies);

            await assert.isRejected(writer.commit(), "File not found");
        });

        it("should handle corrupted hash file", async () => {
            const writer = new FileHashWriter("/test/selectivity");
            const dependencies = {
                css: ["src/styles.css"],
                js: [],
                modules: [],
            };

            fsExtraStub.exists.resolves(true);
            fsExtraStub.readFile.resolves("invalid json");
            fileHashProviderMock.calculateFor.withArgs("src/styles.css").resolves("new-hash");

            writer.add(dependencies);
            await writer.commit();

            // Should create new file structure when JSON parsing fails
            assert.calledWith(
                fsExtraStub.outputJSON,
                "/test/selectivity/hashes.json",
                {
                    files: { "src/styles.css": "new-hash" },
                    modules: {},
                },
                { spaces: 2 },
            );
        });

        it("should sort objects after updating", async () => {
            const writer = new FileHashWriter("/test/selectivity");
            const dependencies = {
                css: ["src/styles.css"],
                js: [],
                modules: ["node_modules/react"],
            };

            fsExtraStub.exists.resolves(false);
            fileHashProviderMock.calculateFor
                .withArgs("src/styles.css")
                .resolves("css-hash")
                .withArgs("node_modules/react/package.json")
                .resolves("module-hash");

            writer.add(dependencies);
            await writer.commit();

            assert.calledTwice(shallowSortObjectStub);
        });
    });

    describe("getFileHashWriter", () => {
        it("should return memoized instance", () => {
            const path1 = "/test/path1";
            const path2 = "/test/path2";

            const writer1a = getFileHashWriter(path1);
            const writer1b = getFileHashWriter(path1);
            const writer2 = getFileHashWriter(path2);

            assert.equal(writer1a, writer1b);
            assert.notEqual(writer1a, writer2);
        });
    });
});
