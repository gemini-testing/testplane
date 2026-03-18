import sinon, { SinonStub } from "sinon";
import proxyquire from "proxyquire";
import type { TestDependenciesFileContents } from "src/browser/cdp/selectivity/types";

describe("CDP/Selectivity/MergeDumps/MergeTests", () => {
    const sandbox = sinon.createSandbox();
    let mergeTests: typeof import("src/browser/cdp/selectivity/merge-dumps/merge-tests").mergeTests;

    let fsStub: {
        readdir: SinonStub;
        ensureDir: SinonStub;
        copyFile: SinonStub;
    };
    let pathStub: {
        join: SinonStub;
        basename: SinonStub;
    };
    let getSelectivityTestsPathStub: SinonStub;
    let shallowSortObjectStub: SinonStub;
    let getExistingJsonPathWithCompressionStub: SinonStub;
    let readJsonWithCompressionStub: SinonStub;
    let stripCompressionSuffixStub: SinonStub;
    let writeJsonWithCompressionStub: SinonStub;

    beforeEach(() => {
        fsStub = {
            readdir: sandbox.stub().resolves([]),
            ensureDir: sandbox.stub().resolves(),
            copyFile: sandbox.stub().resolves(),
        };
        pathStub = {
            join: sandbox.stub().callsFake((...args: string[]) => args.join("/")),
            basename: sandbox.stub().callsFake((p: string) => p.split("/").pop()),
        };
        getSelectivityTestsPathStub = sandbox.stub().callsFake((p: string) => `${p}/tests`);
        shallowSortObjectStub = sandbox.stub();
        getExistingJsonPathWithCompressionStub = sandbox.stub().callsFake((basePath: string) => ({
            jsonPath: `${basePath}.gz`,
        }));
        readJsonWithCompressionStub = sandbox.stub().resolves({});
        stripCompressionSuffixStub = sandbox.stub().callsFake((file: string) => {
            for (const suffix of [".gz", ".br", ".zstd"]) {
                if (file.endsWith(suffix)) {
                    return file.slice(0, -suffix.length);
                }
            }
            return file;
        });
        writeJsonWithCompressionStub = sandbox.stub().resolves();

        mergeTests = proxyquire("src/browser/cdp/selectivity/merge-dumps/merge-tests", {
            "fs-extra": fsStub,
            path: pathStub,
            "../utils": {
                getSelectivityTestsPath: getSelectivityTestsPathStub,
                shallowSortObject: shallowSortObjectStub,
            },
            "../json-utils": {
                getExistingJsonPathWithCompression: getExistingJsonPathWithCompressionStub,
                readJsonWithCompression: readJsonWithCompressionStub,
                stripCompressionSuffix: stripCompressionSuffixStub,
                writeJsonWithCompression: writeJsonWithCompressionStub,
            },
        }).mergeTests;
    });

    afterEach(() => {
        sandbox.restore();
    });

    it("should ensure destination tests directory exists", async () => {
        await mergeTests("/dest", ["/src1"], "none");

        assert.calledWith(fsStub.ensureDir, "/dest/tests");
    });

    it("should read files from each source test directory", async () => {
        fsStub.readdir.resolves([]);

        await mergeTests("/dest", ["/src1", "/src2"], "none");

        assert.calledWith(fsStub.readdir, "/src1/tests");
        assert.calledWith(fsStub.readdir, "/src2/tests");
    });

    it("should copy file directly when present in only one source", async () => {
        fsStub.readdir.withArgs("/src1/tests").resolves(["test1.json.gz"]).withArgs("/src2/tests").resolves([]);

        await mergeTests("/dest", ["/src1", "/src2"], "gz");

        assert.calledOnce(fsStub.copyFile);
        assert.calledWith(fsStub.copyFile, "/src1/tests/test1.json.gz", "/dest/tests/test1.json.gz");
    });

    it("should merge contents when same test file exists in multiple sources", async () => {
        fsStub.readdir
            .withArgs("/src1/tests")
            .resolves(["test1.json.gz"])
            .withArgs("/src2/tests")
            .resolves(["test1.json.gz"]);

        const content1: TestDependenciesFileContents = {
            chrome: { browser: { css: ["a.css"], js: ["a.js"], modules: ["react"] } },
        };
        const content2: TestDependenciesFileContents = {
            firefox: { browser: { css: ["b.css"], js: ["b.js"], modules: ["vue"] } },
        };

        readJsonWithCompressionStub.onFirstCall().resolves(content1).onSecondCall().resolves(content2);

        await mergeTests("/dest", ["/src1", "/src2"], "gz");

        assert.notCalled(fsStub.copyFile);
        assert.calledTwice(readJsonWithCompressionStub);
        assert.calledOnce(writeJsonWithCompressionStub);
    });

    it("should merge browser entries from multiple sources for same test", async () => {
        fsStub.readdir
            .withArgs("/src1/tests")
            .resolves(["test1.json"])
            .withArgs("/src2/tests")
            .resolves(["test1.json"]);

        const content1: TestDependenciesFileContents = {
            chrome: { browser: { css: ["a.css"], js: [], modules: [] } },
        };
        const content2: TestDependenciesFileContents = {
            firefox: { browser: { css: ["b.css"], js: [], modules: [] } },
        };

        readJsonWithCompressionStub.onFirstCall().resolves(content1).onSecondCall().resolves(content2);

        await mergeTests("/dest", ["/src1", "/src2"], "none");

        const writtenData = writeJsonWithCompressionStub.firstCall.args[1] as TestDependenciesFileContents;
        assert.deepInclude(Object.keys(writtenData), "chrome");
        assert.deepInclude(Object.keys(writtenData), "firefox");
    });

    it("should merge dependency scopes within same browser across sources", async () => {
        fsStub.readdir
            .withArgs("/src1/tests")
            .resolves(["test1.json"])
            .withArgs("/src2/tests")
            .resolves(["test1.json"]);

        const content1: TestDependenciesFileContents = {
            chrome: { browser: { css: ["a.css"], js: ["a.js"], modules: [] } },
        };
        const content2: TestDependenciesFileContents = {
            chrome: { testplane: { css: ["b.css"], js: ["b.js"], modules: [] } },
        };

        readJsonWithCompressionStub.onFirstCall().resolves(content1).onSecondCall().resolves(content2);

        await mergeTests("/dest", ["/src1", "/src2"], "none");

        const writtenData = writeJsonWithCompressionStub.firstCall.args[1] as TestDependenciesFileContents;
        assert.property(writtenData, "chrome");
        assert.property(writtenData.chrome, "browser");
        assert.property(writtenData.chrome, "testplane");
    });

    it("should deduplicate dependencies when merging same browser+scope across sources", async () => {
        fsStub.readdir
            .withArgs("/src1/tests")
            .resolves(["test1.json"])
            .withArgs("/src2/tests")
            .resolves(["test1.json"]);

        const content1: TestDependenciesFileContents = {
            chrome: { browser: { css: ["common.css", "a.css"], js: ["common.js"], modules: ["react"] } },
        };
        const content2: TestDependenciesFileContents = {
            chrome: { browser: { css: ["common.css", "b.css"], js: ["common.js"], modules: ["react"] } },
        };

        readJsonWithCompressionStub.onFirstCall().resolves(content1).onSecondCall().resolves(content2);

        await mergeTests("/dest", ["/src1", "/src2"], "none");

        const writtenData = writeJsonWithCompressionStub.firstCall.args[1] as TestDependenciesFileContents;
        assert.deepEqual(writtenData.chrome.browser.css, ["a.css", "b.css", "common.css"]);
        assert.deepEqual(writtenData.chrome.browser.js, ["common.js"]);
        assert.deepEqual(writtenData.chrome.browser.modules, ["react"]);
    });

    it("should sort dependencies after merge", async () => {
        fsStub.readdir
            .withArgs("/src1/tests")
            .resolves(["test1.json"])
            .withArgs("/src2/tests")
            .resolves(["test1.json"]);

        const content1: TestDependenciesFileContents = {
            chrome: { browser: { css: ["z.css"], js: ["z.js"], modules: ["vue"] } },
        };
        const content2: TestDependenciesFileContents = {
            chrome: { browser: { css: ["a.css"], js: ["a.js"], modules: ["axios"] } },
        };

        readJsonWithCompressionStub.onFirstCall().resolves(content1).onSecondCall().resolves(content2);

        await mergeTests("/dest", ["/src1", "/src2"], "none");

        const writtenData = writeJsonWithCompressionStub.firstCall.args[1] as TestDependenciesFileContents;
        assert.deepEqual(writtenData.chrome.browser.css, ["a.css", "z.css"]);
        assert.deepEqual(writtenData.chrome.browser.js, ["a.js", "z.js"]);
        assert.deepEqual(writtenData.chrome.browser.modules, ["axios", "vue"]);
    });

    it("should call shallowSortObject on merged result", async () => {
        fsStub.readdir
            .withArgs("/src1/tests")
            .resolves(["test1.json"])
            .withArgs("/src2/tests")
            .resolves(["test1.json"]);

        readJsonWithCompressionStub.resolves({
            chrome: { browser: { css: [], js: [], modules: [] } },
        });

        await mergeTests("/dest", ["/src1", "/src2"], "none");

        assert.called(shallowSortObjectStub);
    });

    it("should handle files with different compression suffixes as same base file", async () => {
        fsStub.readdir
            .withArgs("/src1/tests")
            .resolves(["test1.json.gz"])
            .withArgs("/src2/tests")
            .resolves(["test1.json.br"]);

        readJsonWithCompressionStub.resolves({
            chrome: { browser: { css: [], js: [], modules: [] } },
        });

        await mergeTests("/dest", ["/src1", "/src2"], "gz");

        // Both resolve to "test1.json" after stripping suffix, so they should be merged
        assert.calledTwice(readJsonWithCompressionStub);
        assert.notCalled(fsStub.copyFile);
    });

    it("should throw if getExistingJsonPathWithCompression returns null path for copy", async () => {
        fsStub.readdir.withArgs("/src1/tests").resolves(["test1.json.gz"]).withArgs("/src2/tests").resolves([]);

        getExistingJsonPathWithCompressionStub.returns({ jsonPath: null });

        await assert.isRejected(
            mergeTests("/dest", ["/src1", "/src2"], "gz"),
            /Can't merge reports: no suitable source file was found/,
        );
    });

    it("should throw if reading source file for merge fails", async () => {
        fsStub.readdir
            .withArgs("/src1/tests")
            .resolves(["test1.json"])
            .withArgs("/src2/tests")
            .resolves(["test1.json"]);

        readJsonWithCompressionStub.rejects(new Error("Read error"));

        await assert.isRejected(mergeTests("/dest", ["/src1", "/src2"], "none"), /Couldn't read .* with compression/);
    });

    it("should handle multiple unique files across sources", async () => {
        fsStub.readdir
            .withArgs("/src1/tests")
            .resolves(["test1.json", "test2.json"])
            .withArgs("/src2/tests")
            .resolves(["test3.json", "test4.json"]);

        await mergeTests("/dest", ["/src1", "/src2"], "none");

        assert.callCount(fsStub.copyFile, 4);
    });

    it("should handle mix of unique and shared files", async () => {
        fsStub.readdir
            .withArgs("/src1/tests")
            .resolves(["test1.json", "shared.json"])
            .withArgs("/src2/tests")
            .resolves(["test2.json", "shared.json"]);

        readJsonWithCompressionStub.resolves({
            chrome: { browser: { css: [], js: [], modules: [] } },
        });

        await mergeTests("/dest", ["/src1", "/src2"], "none");

        // test1.json and test2.json are copied, shared.json is merged
        assert.calledTwice(fsStub.copyFile);
        assert.calledTwice(readJsonWithCompressionStub);
        assert.calledOnce(writeJsonWithCompressionStub);
    });

    it("should handle empty source directories", async () => {
        fsStub.readdir.resolves([]);

        await mergeTests("/dest", ["/src1", "/src2"], "none");

        assert.notCalled(fsStub.copyFile);
        assert.notCalled(readJsonWithCompressionStub);
        assert.notCalled(writeJsonWithCompressionStub);
    });
});
