import sinon, { SinonStub } from "sinon";
import proxyquire from "proxyquire";

describe("CDP/Selectivity/MergeDumps/MergeHashes", () => {
    const sandbox = sinon.createSandbox();
    let mergeHashes: typeof import("src/browser/cdp/selectivity/merge-dumps/merge-hashes").mergeHashes;

    let getSelectivityHashesPathStub: SinonStub;
    let readHashFileContentsStub: SinonStub;
    let writeJsonWithCompressionStub: SinonStub;

    beforeEach(() => {
        getSelectivityHashesPathStub = sandbox.stub().callsFake((p: string) => `${p}/hashes.json`);
        readHashFileContentsStub = sandbox.stub();
        writeJsonWithCompressionStub = sandbox.stub().resolves();

        mergeHashes = proxyquire("src/browser/cdp/selectivity/merge-dumps/merge-hashes", {
            "../utils": {
                getSelectivityHashesPath: getSelectivityHashesPathStub,
                readHashFileContents: readHashFileContentsStub,
            },
            "../json-utils": {
                writeJsonWithCompression: writeJsonWithCompressionStub,
            },
        }).mergeHashes;
    });

    afterEach(() => {
        sandbox.restore();
    });

    it("should read hashes from all source paths", async () => {
        const emptyHashes = { files: {}, modules: {}, patterns: {} };
        readHashFileContentsStub.resolves(emptyHashes);

        await mergeHashes("/dest", ["/src1", "/src2"], "none");

        assert.calledWith(readHashFileContentsStub, "/src1/hashes.json", "none");
        assert.calledWith(readHashFileContentsStub, "/src2/hashes.json", "none");
    });

    it("should merge file hashes from multiple sources", async () => {
        readHashFileContentsStub
            .onFirstCall()
            .resolves({ files: { "a.js": "hash-a" }, modules: {}, patterns: {} })
            .onSecondCall()
            .resolves({ files: { "b.js": "hash-b" }, modules: {}, patterns: {} });

        await mergeHashes("/dest", ["/src1", "/src2"], "none");

        assert.calledWith(
            writeJsonWithCompressionStub,
            "/dest/hashes.json",
            {
                files: { "a.js": "hash-a", "b.js": "hash-b" },
                modules: {},
                patterns: {},
            },
            "none",
        );
    });

    it("should merge module hashes from multiple sources", async () => {
        readHashFileContentsStub
            .onFirstCall()
            .resolves({ files: {}, modules: { react: "hash-react" }, patterns: {} })
            .onSecondCall()
            .resolves({ files: {}, modules: { lodash: "hash-lodash" }, patterns: {} });

        await mergeHashes("/dest", ["/src1", "/src2"], "gz");

        assert.calledWith(
            writeJsonWithCompressionStub,
            "/dest/hashes.json",
            {
                files: {},
                modules: { react: "hash-react", lodash: "hash-lodash" },
                patterns: {},
            },
            "gz",
        );
    });

    it("should merge pattern hashes from multiple sources", async () => {
        readHashFileContentsStub
            .onFirstCall()
            .resolves({ files: {}, modules: {}, patterns: { "*.js": "hash-js" } })
            .onSecondCall()
            .resolves({ files: {}, modules: {}, patterns: { "*.css": "hash-css" } });

        await mergeHashes("/dest", ["/src1", "/src2"], "none");

        assert.calledWith(
            writeJsonWithCompressionStub,
            "/dest/hashes.json",
            {
                files: {},
                modules: {},
                patterns: { "*.js": "hash-js", "*.css": "hash-css" },
            },
            "none",
        );
    });

    it("should allow same key with same hash value across sources", async () => {
        readHashFileContentsStub
            .onFirstCall()
            .resolves({ files: { "a.js": "same-hash" }, modules: {}, patterns: {} })
            .onSecondCall()
            .resolves({ files: { "a.js": "same-hash" }, modules: {}, patterns: {} });

        await mergeHashes("/dest", ["/src1", "/src2"], "none");

        assert.calledWith(
            writeJsonWithCompressionStub,
            "/dest/hashes.json",
            {
                files: { "a.js": "same-hash" },
                modules: {},
                patterns: {},
            },
            "none",
        );
    });

    it("should throw if same file key has different hashes across sources", async () => {
        readHashFileContentsStub
            .onFirstCall()
            .resolves({ files: { "a.js": "hash-1" }, modules: {}, patterns: {} })
            .onSecondCall()
            .resolves({ files: { "a.js": "hash-2" }, modules: {}, patterns: {} });

        await assert.isRejected(
            mergeHashes("/dest", ["/src1", "/src2"], "none"),
            /Hashes for "files" "a\.js" are not equal in different chunks/,
        );
    });

    it("should throw if same module key has different hashes across sources", async () => {
        readHashFileContentsStub
            .onFirstCall()
            .resolves({ files: {}, modules: { react: "hash-1" }, patterns: {} })
            .onSecondCall()
            .resolves({ files: {}, modules: { react: "hash-2" }, patterns: {} });

        await assert.isRejected(
            mergeHashes("/dest", ["/src1", "/src2"], "none"),
            /Hashes for "modules" "react" are not equal in different chunks/,
        );
    });

    it("should throw if same pattern key has different hashes across sources", async () => {
        readHashFileContentsStub
            .onFirstCall()
            .resolves({ files: {}, modules: {}, patterns: { "*.js": "hash-1" } })
            .onSecondCall()
            .resolves({ files: {}, modules: {}, patterns: { "*.js": "hash-2" } });

        await assert.isRejected(
            mergeHashes("/dest", ["/src1", "/src2"], "none"),
            /Hashes for "patterns" "\*\.js" are not equal in different chunks/,
        );
    });

    it("should write result with preferred compression type", async () => {
        const emptyHashes = { files: {}, modules: {}, patterns: {} };
        readHashFileContentsStub.resolves(emptyHashes);

        await mergeHashes("/dest", ["/src1"], "br");

        assert.calledWith(writeJsonWithCompressionStub, "/dest/hashes.json", sinon.match.object, "br");
    });

    it("should handle single source path", async () => {
        readHashFileContentsStub.resolves({
            files: { "a.js": "hash-a" },
            modules: { react: "hash-react" },
            patterns: { "*.js": "hash-js" },
        });

        await mergeHashes("/dest", ["/src1"], "none");

        assert.calledWith(
            writeJsonWithCompressionStub,
            "/dest/hashes.json",
            {
                files: { "a.js": "hash-a" },
                modules: { react: "hash-react" },
                patterns: { "*.js": "hash-js" },
            },
            "none",
        );
    });

    it("should handle empty sources", async () => {
        await mergeHashes("/dest", [], "none");

        assert.calledWith(
            writeJsonWithCompressionStub,
            "/dest/hashes.json",
            {
                files: {},
                modules: {},
                patterns: {},
            },
            "none",
        );
    });

    it("should merge hashes from three sources correctly", async () => {
        readHashFileContentsStub
            .onCall(0)
            .resolves({ files: { "a.js": "hash-a" }, modules: {}, patterns: {} })
            .onCall(1)
            .resolves({ files: { "b.js": "hash-b" }, modules: { react: "hash-react" }, patterns: {} })
            .onCall(2)
            .resolves({ files: { "c.js": "hash-c" }, modules: {}, patterns: { "*.js": "hash-js" } });

        await mergeHashes("/dest", ["/src1", "/src2", "/src3"], "none");

        assert.calledWith(
            writeJsonWithCompressionStub,
            "/dest/hashes.json",
            {
                files: { "a.js": "hash-a", "b.js": "hash-b", "c.js": "hash-c" },
                modules: { react: "hash-react" },
                patterns: { "*.js": "hash-js" },
            },
            "none",
        );
    });
});
