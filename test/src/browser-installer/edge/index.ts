import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { ChildProcess } from "child_process";
import type { runEdgeDriver as RunEdgeDriverType } from "../../../../src/browser-installer/edge";

describe("browser-installer/edge", () => {
    const sandbox = sinon.createSandbox();

    let runEdgeDriver: typeof RunEdgeDriverType;

    let pipeLogsWithPrefixStub: SinonStub;
    let installEdgeDriverStub: SinonStub;
    let spawnStub: SinonStub;

    let getPortStub: SinonStub;
    let waitPortStub: SinonStub;

    beforeEach(() => {
        pipeLogsWithPrefixStub = sandbox.stub();
        installEdgeDriverStub = sandbox.stub().resolves("/driver/path");
        spawnStub = sandbox.stub().returns({ kill: sandbox.stub() });
        getPortStub = sandbox.stub().resolves(12345);
        waitPortStub = sandbox.stub().resolves();

        runEdgeDriver = proxyquire("../../../../src/browser-installer/edge", {
            "../../dev-server/utils": { pipeLogsWithPrefix: pipeLogsWithPrefixStub },
            "./driver": { installEdgeDriver: installEdgeDriverStub },
            child_process: { spawn: spawnStub }, // eslint-disable-line camelcase
            "wait-port": waitPortStub,
            "get-port": getPortStub,
        }).runEdgeDriver;
    });

    afterEach(() => sandbox.restore());

    it("should launch child process on random port", async () => {
        installEdgeDriverStub.resolves("/driver/path");
        getPortStub.resolves(10050);

        await runEdgeDriver("130");

        assert.calledOnceWith(installEdgeDriverStub, "130");
        assert.calledOnceWith(spawnStub, "/driver/path", ["--port=10050", "--silent"]);
    });

    it("should wait for port to be active", async () => {
        getPortStub.resolves(10050);

        await runEdgeDriver("130");

        assert.calledOnceWith(waitPortStub, { port: 10050, output: "silent", timeout: 10000, interval: 25 });
    });

    it("should be executed in right order", async () => {
        await runEdgeDriver("130");

        assert.callOrder(installEdgeDriverStub, getPortStub, spawnStub, waitPortStub);
    });

    it("should return gridUrl, process and port", async () => {
        const processStub = { kill: sandbox.stub() } as unknown as ChildProcess;
        spawnStub.returns(processStub);
        getPortStub.resolves(10050);

        const result = await runEdgeDriver("130");

        assert.equal(result.gridUrl, "http://127.0.0.1:10050");
        assert.equal(result.port, 10050);
        assert.equal(result.process, processStub);
    });

    it("should pipe logs if debug is enabled", async () => {
        const result = await runEdgeDriver("130", { debug: true });

        assert.calledOnceWith(spawnStub, "/driver/path", ["--port=12345", "--verbose"]);
        assert.calledOnceWith(pipeLogsWithPrefixStub, result.process, "[edgedriver@130] ");
    });

    it("should not pipe logs if debug is not enabled", async () => {
        await runEdgeDriver("130");

        assert.notCalled(pipeLogsWithPrefixStub);
    });
});
