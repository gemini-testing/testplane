import proxyquire from "proxyquire";
import sinon from "sinon";
import type { installUbuntuPackages as InstallUbuntuPackages } from "../../../../src/browser-installer/ubuntu-packages/apt";

describe("browser-installer/ubuntu-packages/apt", () => {
    it("should complete progress when all dependencies are already installed", async () => {
        const execStub = sinon.stub();
        const downloadProgressCallback = sinon.spy();

        execStub.onFirstCall().yields(null, "foo\n");
        execStub.onSecondCall().yields(null, "foo/stable,now 1.0 amd64 [installed]\n");

        const { installUbuntuPackages } = proxyquire("../../../../src/browser-installer/ubuntu-packages/apt", {
            child_process: { exec: execStub }, // eslint-disable-line camelcase
            "./utils": { ensureUnixBinaryExists: sinon.stub().resolves() },
        }) as { installUbuntuPackages: typeof InstallUbuntuPackages };

        await installUbuntuPackages(["foo"], "/packages", { downloadProgressCallback });

        assert.deepEqual(downloadProgressCallback.lastCall.args, [100]);
        assert.calledTwice(execStub);
    });
});
