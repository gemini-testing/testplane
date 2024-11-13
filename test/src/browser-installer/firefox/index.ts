import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { ChildProcess } from "child_process";
import type { runGeckoDriver as RunGeckoDriverType } from "../../../../src/browser-installer/firefox";

describe("browser-installer/firefox", () => {
    const sandbox = sinon.createSandbox();

    let runGeckoDriver: typeof RunGeckoDriverType;

    let pipeLogsWithPrefixStub: SinonStub;
    let installFirefoxStub: SinonStub;
    let installLatestGeckoDriverStub: SinonStub;
    let startGeckoDriverStub: SinonStub;

    let getPortStub: SinonStub;
    let waitPortStub: SinonStub;

    beforeEach(() => {
        pipeLogsWithPrefixStub = sandbox.stub();
        installFirefoxStub = sandbox.stub().resolves("/browser/path");
        installLatestGeckoDriverStub = sandbox.stub().resolves("/driver/path");
        startGeckoDriverStub = sandbox.stub().returns({ kill: sandbox.stub() });
        getPortStub = sandbox.stub().resolves(12345);
        waitPortStub = sandbox.stub().resolves();

        runGeckoDriver = proxyquire("../../../../src/browser-installer/firefox", {
            "../../dev-server/utils": { pipeLogsWithPrefix: pipeLogsWithPrefixStub },
            "./browser": { installFirefox: installFirefoxStub },
            "./driver": { installLatestGeckoDriver: installLatestGeckoDriverStub },
            geckodriver: { start: startGeckoDriverStub },
            "wait-port": waitPortStub,
            "get-port": getPortStub,
        }).runGeckoDriver;
    });

    afterEach(() => sandbox.restore());

    it("should launch child process on random port", async () => {
        installLatestGeckoDriverStub.resolves("/driver/path");
        getPortStub.resolves(10050);

        await runGeckoDriver("130");

        assert.calledOnceWith(startGeckoDriverStub, {
            customGeckoDriverPath: "/driver/path",
            port: 10050,
            spawnOpts: {
                windowsHide: true,
                detached: false,
            },
        });
    });

    it("should wait for port to be active", async () => {
        getPortStub.resolves(10050);

        await runGeckoDriver("130");

        assert.calledOnceWith(waitPortStub, { port: 10050, output: "silent", timeout: 10000 });
    });

    it("should be executed in right order", async () => {
        await runGeckoDriver("130");

        assert.callOrder(installLatestGeckoDriverStub, getPortStub, startGeckoDriverStub, waitPortStub);
    });

    it("should return gridUrl, process and port", async () => {
        const processStub = { kill: sandbox.stub() } as unknown as ChildProcess;
        startGeckoDriverStub.returns(processStub);
        getPortStub.resolves(10050);

        const result = await runGeckoDriver("130");

        assert.equal(result.gridUrl, "http://127.0.0.1:10050");
        assert.equal(result.port, 10050);
        assert.equal(result.process, processStub);
    });

    it("should pipe logs if debug is enabled", async () => {
        const result = await runGeckoDriver("130", { debug: true });

        assert.calledOnceWith(pipeLogsWithPrefixStub, result.process, "[geckodriver@130] ");
    });

    it("should not pipe logs if debug is not enabled", async () => {
        await runGeckoDriver("130");

        assert.notCalled(pipeLogsWithPrefixStub);
    });
});
