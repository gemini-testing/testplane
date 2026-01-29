import sinon, { SinonStub } from "sinon";
import proxyquire from "proxyquire";

describe("CDP/Selectivity/HashReader", () => {
    const sandbox = sinon.createSandbox();
    let HashReader: any;
    let getHashReader: typeof import("src/browser/cdp/selectivity/hash-reader").getHashReader;
    let HashProviderStub: SinonStub;
    let pathStub: { join: SinonStub };
    let hashProviderMock: { calculateForFile: SinonStub; calculateForPattern: SinonStub };
    let readHashFileContentsStub: SinonStub;
    let getSelectivityHashesPathStub: SinonStub;

    beforeEach(() => {
        hashProviderMock = {
            calculateForFile: sandbox.stub(),
            calculateForPattern: sandbox.stub(),
        };
        HashProviderStub = sandbox.stub().returns(hashProviderMock);
        pathStub = {
            join: sandbox.stub().callsFake((...args) => args.join("/")),
        };
        readHashFileContentsStub = sandbox.stub();
        getSelectivityHashesPathStub = sandbox.stub().returns("/test/selectivity/hashes.json");

        const proxyquiredModule = proxyquire("src/browser/cdp/selectivity/hash-reader", {
            "node:path": pathStub,
            "./hash-provider": { HashProvider: HashProviderStub },
            "./utils": {
                readHashFileContents: readHashFileContentsStub,
                getSelectivityHashesPath: getSelectivityHashesPathStub,
            },
        });

        HashReader = proxyquiredModule.HashReader || proxyquiredModule.default;
        getHashReader = proxyquiredModule.getHashReader;
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("patternHasChanged", () => {
        it("should return false when pattern hash has not changed", async () => {
            const reader = new HashReader("/test/selectivity", "none");
            const pattern = "src/**/*.js";
            const hashFileContents = {
                files: {},
                modules: {},
                patterns: { [pattern]: "pattern-hash-123" },
            };

            readHashFileContentsStub.resolves(hashFileContents);
            hashProviderMock.calculateForPattern.withArgs(pattern).resolves("pattern-hash-123");

            const result = await reader.patternHasChanged(pattern);

            assert.isFalse(result);
            assert.calledWith(hashProviderMock.calculateForPattern, pattern);
        });

        it("should return true when pattern hash has changed", async () => {
            const reader = new HashReader("/test/selectivity", "none");
            const pattern = "src/**/*.js";
            const hashFileContents = {
                files: {},
                modules: {},
                patterns: { [pattern]: "old-pattern-hash" },
            };

            readHashFileContentsStub.resolves(hashFileContents);
            hashProviderMock.calculateForPattern.withArgs(pattern).resolves("new-pattern-hash");

            const result = await reader.patternHasChanged(pattern);

            assert.isTrue(result);
            assert.calledWith(hashProviderMock.calculateForPattern, pattern);
        });

        it("should return true when pattern is not in cache", async () => {
            const reader = new HashReader("/test/selectivity", "none");
            const pattern = "src/**/*.js";
            const hashFileContents = {
                files: {},
                modules: {},
                patterns: {},
            };

            readHashFileContentsStub.resolves(hashFileContents);
            hashProviderMock.calculateForPattern.withArgs(pattern).resolves("new-pattern-hash");

            const result = await reader.patternHasChanged(pattern);

            assert.isTrue(result);
            assert.calledWith(hashProviderMock.calculateForPattern, pattern);
        });

        it("should cache hash file contents on subsequent calls", async () => {
            const reader = new HashReader("/test/selectivity", "none");
            const pattern1 = "src/**/*.js";
            const pattern2 = "src/**/*.css";
            const hashFileContents = {
                files: {},
                modules: {},
                patterns: {
                    [pattern1]: "pattern-hash-1",
                    [pattern2]: "pattern-hash-2",
                },
            };

            readHashFileContentsStub.resolves(hashFileContents);
            hashProviderMock.calculateForPattern.withArgs(pattern1).resolves("pattern-hash-1");
            hashProviderMock.calculateForPattern.withArgs(pattern2).resolves("pattern-hash-2");

            await reader.patternHasChanged(pattern1);
            await reader.patternHasChanged(pattern2);

            assert.calledOnce(readHashFileContentsStub);
        });

        it("should throw error if no files are found by pattern", async () => {
            const reader = new HashReader("/test/selectivity", "none");
            const pattern = "src/**/*.js";
            const patternError = new Error(
                `Selectivity: Couldn't find files by disableSelectivityPattern "${pattern}"`,
            );
            const hashFileContents = {
                files: {},
                modules: {},
                patterns: {},
            };

            readHashFileContentsStub.resolves(hashFileContents);
            hashProviderMock.calculateForPattern.withArgs(pattern).rejects(patternError);

            const result = reader.patternHasChanged(pattern);

            assert.isRejected(result, /Couldn't find files by disableSelectivityPattern/);
            assert.calledWith(hashProviderMock.calculateForPattern, pattern);
        });
    });

    describe("getTestChangedDeps", () => {
        it("should return null when no dependencies have changed", async () => {
            const reader = new HashReader("/test/selectivity", "none");
            const testDeps = {
                css: ["src/styles.css"],
                js: ["src/app.js"],
                modules: ["node_modules/react"],
            };
            const hashFileContents = {
                files: {
                    "src/styles.css": "css-hash",
                    "src/app.js": "js-hash",
                },
                modules: {
                    "node_modules/react": "module-hash",
                },
                patterns: {},
            };

            readHashFileContentsStub.resolves(hashFileContents);
            hashProviderMock.calculateForFile
                .withArgs("src/styles.css")
                .resolves("css-hash")
                .withArgs("src/app.js")
                .resolves("js-hash")
                .withArgs("node_modules/react/package.json")
                .resolves("module-hash");

            const result = await reader.getTestChangedDeps(testDeps);

            assert.isNull(result);
        });

        it("should return changed dependencies when files have changed", async () => {
            const reader = new HashReader("/test/selectivity", "none");
            const testDeps = {
                css: ["src/styles.css", "src/theme.css"],
                js: ["src/app.js"],
                modules: ["node_modules/react"],
            };
            const hashFileContents = {
                files: {
                    "src/styles.css": "old-css-hash",
                    "src/theme.css": "theme-hash",
                    "src/app.js": "old-js-hash",
                },
                modules: {
                    "node_modules/react": "module-hash",
                },
                patterns: {},
            };

            readHashFileContentsStub.resolves(hashFileContents);
            hashProviderMock.calculateForFile
                .withArgs("src/styles.css")
                .resolves("new-css-hash")
                .withArgs("src/theme.css")
                .resolves("theme-hash")
                .withArgs("src/app.js")
                .resolves("new-js-hash")
                .withArgs("node_modules/react/package.json")
                .resolves("module-hash");

            const result = await reader.getTestChangedDeps(testDeps);

            assert.deepEqual(result, {
                css: ["src/styles.css"],
                js: ["src/app.js"],
                modules: [],
            });
        });

        it("should return changed dependencies when modules have changed", async () => {
            const reader = new HashReader("/test/selectivity", "none");
            const testDeps = {
                css: ["src/styles.css"],
                js: [],
                modules: ["node_modules/react", "node_modules/lodash"],
            };
            const hashFileContents = {
                files: {
                    "src/styles.css": "css-hash",
                },
                modules: {
                    "node_modules/react": "old-react-hash",
                    "node_modules/lodash": "lodash-hash",
                },
                patterns: {},
            };

            readHashFileContentsStub.resolves(hashFileContents);
            hashProviderMock.calculateForFile
                .withArgs("src/styles.css")
                .resolves("css-hash")
                .withArgs("node_modules/react/package.json")
                .resolves("new-react-hash")
                .withArgs("node_modules/lodash/package.json")
                .resolves("lodash-hash");

            const result = await reader.getTestChangedDeps(testDeps);

            assert.deepEqual(result, {
                css: [],
                js: [],
                modules: ["node_modules/react"],
            });
        });

        it("should handle missing files in cache", async () => {
            const reader = new HashReader("/test/selectivity", "none");
            const testDeps = {
                css: ["src/new-file.css"],
                js: ["src/new-app.js"],
                modules: ["node_modules/new-lib"],
            };
            const hashFileContents = {
                files: {},
                modules: {},
                patterns: {},
            };

            readHashFileContentsStub.resolves(hashFileContents);
            hashProviderMock.calculateForFile
                .withArgs("src/new-file.css")
                .resolves("new-css-hash")
                .withArgs("src/new-app.js")
                .resolves("new-js-hash")
                .withArgs("node_modules/new-lib/package.json")
                .resolves("new-module-hash");

            const result = await reader.getTestChangedDeps(testDeps);

            assert.deepEqual(result, {
                css: ["src/new-file.css"],
                js: ["src/new-app.js"],
                modules: ["node_modules/new-lib"],
            });
        });

        it("should handle empty dependencies", async () => {
            const reader = new HashReader("/test/selectivity", "none");
            const testDeps = {
                css: [],
                js: [],
                modules: [],
            };
            const hashFileContents = {
                files: {},
                modules: {},
                patterns: {},
            };

            readHashFileContentsStub.resolves(hashFileContents);

            const result = await reader.getTestChangedDeps(testDeps);

            assert.isNull(result);
            assert.notCalled(hashProviderMock.calculateForFile);
        });

        it("should handle mixed changed and unchanged dependencies", async () => {
            const reader = new HashReader("/test/selectivity", "none");
            const testDeps = {
                css: ["src/changed.css", "src/unchanged.css"],
                js: ["src/unchanged.js"],
                modules: ["node_modules/changed-lib", "node_modules/unchanged-lib"],
            };
            const hashFileContents = {
                files: {
                    "src/changed.css": "old-css-hash",
                    "src/unchanged.css": "unchanged-css-hash",
                    "src/unchanged.js": "unchanged-js-hash",
                },
                modules: {
                    "node_modules/changed-lib": "old-lib-hash",
                    "node_modules/unchanged-lib": "unchanged-lib-hash",
                },
                patterns: {},
            };

            readHashFileContentsStub.resolves(hashFileContents);
            hashProviderMock.calculateForFile
                .withArgs("src/changed.css")
                .resolves("new-css-hash")
                .withArgs("src/unchanged.css")
                .resolves("unchanged-css-hash")
                .withArgs("src/unchanged.js")
                .resolves("unchanged-js-hash")
                .withArgs("node_modules/changed-lib/package.json")
                .resolves("new-lib-hash")
                .withArgs("node_modules/unchanged-lib/package.json")
                .resolves("unchanged-lib-hash");

            const result = await reader.getTestChangedDeps(testDeps);

            assert.deepEqual(result, {
                css: ["src/changed.css"],
                js: [],
                modules: ["node_modules/changed-lib"],
            });
        });

        it("should use correct file paths for modules", async () => {
            const reader = new HashReader("/test/selectivity", "none");
            const testDeps = {
                css: [],
                js: [],
                modules: ["node_modules/react"],
            };
            const hashFileContents = {
                files: {},
                modules: { "node_modules/react": "module-hash" },
                patterns: {},
            };

            readHashFileContentsStub.resolves(hashFileContents);
            hashProviderMock.calculateForFile.withArgs("node_modules/react/package.json").resolves("module-hash");

            await reader.getTestChangedDeps(testDeps);

            assert.calledWith(pathStub.join, "node_modules/react", "package.json");
            assert.calledWith(hashProviderMock.calculateForFile, "node_modules/react/package.json");
        });
    });

    describe("getHashReader", () => {
        it("should return memoized instance", () => {
            const path1 = "/test/path1";
            const path2 = "/test/path2";

            const reader1a = getHashReader(path1, "none");
            const reader1b = getHashReader(path1, "none");
            const reader2 = getHashReader(path2, "none");

            assert.equal(reader1a, reader1b);
            assert.notEqual(reader1a, reader2);
        });

        it("should return different instances for different compression types", () => {
            const path = "/test/path";

            const readerNone = getHashReader(path, "none");
            const readerGzip = getHashReader(path, "gz");

            assert.notEqual(readerNone, readerGzip);
        });
    });
});
