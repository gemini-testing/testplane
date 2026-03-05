import sinon, { SinonStub } from "sinon";
import proxyquire from "proxyquire";

describe("CDP/Selectivity/MergeDumps", () => {
    const sandbox = sinon.createSandbox();
    let mergeSelectivityDumps: typeof import("src/browser/cdp/selectivity/merge-dumps/index").mergeSelectivityDumps;

    let fsStub: {
        ensureDir: SinonStub;
        promises: { access: SinonStub };
        constants: { W_OK: number; R_OK: number };
    };
    let pathStub: { resolve: SinonStub };
    let mergeHashesStub: SinonStub;
    let mergeTestsStub: SinonStub;
    let consoleInfoStub: SinonStub;

    beforeEach(() => {
        fsStub = {
            ensureDir: sandbox.stub().resolves(),
            promises: { access: sandbox.stub().resolves() },
            constants: { W_OK: 2, R_OK: 4 },
        };
        pathStub = {
            resolve: sandbox.stub().callsFake((p: string) => `/abs/${p}`),
        };
        mergeHashesStub = sandbox.stub().resolves();
        mergeTestsStub = sandbox.stub().resolves();
        consoleInfoStub = sandbox.stub(console, "info");

        mergeSelectivityDumps = proxyquire("src/browser/cdp/selectivity/merge-dumps/index", {
            "fs-extra": fsStub,
            path: pathStub,
            "./merge-hashes": { mergeHashes: mergeHashesStub },
            "./merge-tests": { mergeTests: mergeTestsStub },
        }).mergeSelectivityDumps;
    });

    afterEach(() => {
        sandbox.restore();
    });

    it("should ensure destination directory exists", async () => {
        await mergeSelectivityDumps("dest", ["src1"], "none");

        assert.calledOnceWith(fsStub.ensureDir, "/abs/dest");
    });

    it("should check write access on destination directory", async () => {
        await mergeSelectivityDumps("dest", ["src1"], "none");

        assert.calledWith(fsStub.promises.access, "/abs/dest", fsStub.constants.W_OK);
    });

    it("should throw if destination directory is not writable", async () => {
        fsStub.promises.access.withArgs("/abs/dest", fsStub.constants.W_OK).rejects(new Error("EACCES"));

        await assert.isRejected(
            mergeSelectivityDumps("dest", ["src1"], "none"),
            /Couldn't get write access to destination directory/,
        );
    });

    it("should check read access on each source directory", async () => {
        await mergeSelectivityDumps("dest", ["src1", "src2"], "none");

        assert.calledWith(fsStub.promises.access, "/abs/src1", fsStub.constants.R_OK);
        assert.calledWith(fsStub.promises.access, "/abs/src2", fsStub.constants.R_OK);
    });

    it("should throw if source directory is not readable", async () => {
        fsStub.promises.access.callsFake((path: string, mode: number) => {
            if (path === "/abs/src2" && mode === fsStub.constants.R_OK) {
                return Promise.reject(new Error("EACCES"));
            }
            return Promise.resolve();
        });

        await assert.isRejected(
            mergeSelectivityDumps("dest", ["src1", "src2"], "none"),
            /Couldn't get read access to source directory/,
        );
    });

    it("should call mergeHashes with correct arguments", async () => {
        await mergeSelectivityDumps("dest", ["src1", "src2"], "gz");

        assert.calledOnceWith(mergeHashesStub, "/abs/dest", ["/abs/src1", "/abs/src2"], "gz");
    });

    it("should call mergeTests with correct arguments", async () => {
        await mergeSelectivityDumps("dest", ["src1", "src2"], "br");

        assert.calledOnceWith(mergeTestsStub, "/abs/dest", ["/abs/src1", "/abs/src2"], "br");
    });

    it("should call mergeHashes before mergeTests", async () => {
        await mergeSelectivityDumps("dest", ["src1"], "none");

        assert.callOrder(mergeHashesStub, mergeTestsStub);
    });

    it("should log success message after merge", async () => {
        await mergeSelectivityDumps("dest", ["src1"], "none");

        assert.calledOnceWith(consoleInfoStub, sinon.match(/Successfully merged selectivity dumps into/));
    });

    it("should handle empty source paths", async () => {
        await mergeSelectivityDumps("dest", [], "none");

        assert.calledOnce(mergeHashesStub);
        assert.calledOnce(mergeTestsStub);
    });
});
