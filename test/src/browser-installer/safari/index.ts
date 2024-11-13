import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { ChildProcess } from "child_process";
import type { runSafariDriver as RunSafariDriverType } from "../../../../src/browser-installer/safari";

describe("browser-installer/edge", () => {
    const sandbox = sinon.createSandbox();

    let runSafariDriver: typeof RunSafariDriverType;

    let pipeLogsWithPrefixStub: SinonStub;
    let spawnStub: SinonStub;

    let getPortStub: SinonStub;
    let waitPortStub: SinonStub;

    beforeEach(() => {
        pipeLogsWithPrefixStub = sandbox.stub();
        spawnStub = sandbox.stub().returns({ kill: sandbox.stub() });
        getPortStub = sandbox.stub().resolves(12345);
        waitPortStub = sandbox.stub().resolves();

        runSafariDriver = proxyquire("../../../../src/browser-installer/safari", {
            "../../dev-server/utils": { pipeLogsWithPrefix: pipeLogsWithPrefixStub },
            child_process: { spawn: spawnStub }, // eslint-disable-line camelcase
            "wait-port": waitPortStub,
            "get-port": getPortStub,
        }).runSafariDriver;
    });

    afterEach(() => sandbox.restore());

    it("should launch child process on random port", async () => {
        getPortStub.resolves(10050);

        await runSafariDriver();

        assert.calledOnceWith(spawnStub, "/usr/bin/safaridriver", ["--port=10050"]);
    });

    it("should wait for port to be active", async () => {
        getPortStub.resolves(10050);

        await runSafariDriver();

        assert.calledOnceWith(waitPortStub, { port: 10050, output: "silent", timeout: 10000 });
    });

    it("should be executed in right order", async () => {
        await runSafariDriver();

        assert.callOrder(getPortStub, spawnStub, waitPortStub);
    });

    it("should return gridUrl, process and port", async () => {
        const processStub = { kill: sandbox.stub() } as unknown as ChildProcess;
        spawnStub.returns(processStub);
        getPortStub.resolves(10050);

        const result = await runSafariDriver();

        assert.equal(result.gridUrl, "http://127.0.0.1:10050");
        assert.equal(result.port, 10050);
        assert.equal(result.process, processStub);
    });

    it("should pipe logs if debug is enabled", async () => {
        const result = await runSafariDriver({ debug: true });

        assert.calledOnceWith(pipeLogsWithPrefixStub, result.process, "[safaridriver] ");
    });

    it("should not pipe logs if debug is not enabled", async () => {
        await runSafariDriver();

        assert.notCalled(pipeLogsWithPrefixStub);
    });
});
