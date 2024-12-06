import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { ChildProcess } from "child_process";
import type { runChromeDriver as RunChromeDriverType } from "../../../../src/browser-installer/chrome";

describe("browser-installer/chrome", () => {
    const sandbox = sinon.createSandbox();

    let runChromeDriver: typeof RunChromeDriverType;

    let pipeLogsWithPrefixStub: SinonStub;
    let installChromeStub: SinonStub;
    let installChromeDriverStub: SinonStub;
    let spawnStub: SinonStub;

    let getPortStub: SinonStub;
    let waitPortStub: SinonStub;

    let isUbuntuStub: SinonStub;
    let getUbuntuLinkerEnvStub: SinonStub;
    let installUbuntuPackageDependenciesStub: SinonStub;

    beforeEach(() => {
        pipeLogsWithPrefixStub = sandbox.stub();
        installChromeStub = sandbox.stub().resolves("/browser/path");
        installChromeDriverStub = sandbox.stub().resolves("/driver/path");
        spawnStub = sandbox.stub().returns({ kill: sandbox.stub() });
        getPortStub = sandbox.stub().resolves(12345);
        waitPortStub = sandbox.stub().resolves();

        isUbuntuStub = sandbox.stub().resolves(false);
        getUbuntuLinkerEnvStub = sandbox.stub().resolves({ LD_LINKER_PATH: "foobar" });
        installUbuntuPackageDependenciesStub = sandbox.stub().resolves();

        runChromeDriver = proxyquire("../../../../src/browser-installer/chrome", {
            "../../dev-server/utils": { pipeLogsWithPrefix: pipeLogsWithPrefixStub },
            "./driver": { installChromeDriver: installChromeDriverStub },
            "./browser": { installChrome: installChromeStub },
            "../ubuntu-packages": {
                isUbuntu: isUbuntuStub,
                getUbuntuLinkerEnv: getUbuntuLinkerEnvStub,
                installUbuntuPackageDependencies: installUbuntuPackageDependenciesStub,
            },
            child_process: { spawn: spawnStub }, // eslint-disable-line camelcase
            "wait-port": waitPortStub,
            "get-port": getPortStub,
        }).runChromeDriver;
    });

    afterEach(() => sandbox.restore());

    it("should launch child process on random port", async () => {
        installChromeDriverStub.resolves("/driver/path");
        getPortStub.resolves(10050);

        await runChromeDriver("130");

        assert.calledOnceWith(installChromeDriverStub, "130");
        assert.calledOnceWith(spawnStub, "/driver/path", ["--port=10050", "--silent"]);
    });

    it("should wait for port to be active", async () => {
        getPortStub.resolves(10050);

        await runChromeDriver("130");

        assert.calledOnceWith(waitPortStub, { port: 10050, output: "silent", timeout: 10000 });
    });

    it("should be executed in right order", async () => {
        await runChromeDriver("130");

        assert.callOrder(installChromeDriverStub, getPortStub, spawnStub, waitPortStub);
    });

    it("should return gridUrl, process and port", async () => {
        const processStub = { kill: sandbox.stub() } as unknown as ChildProcess;
        spawnStub.returns(processStub);
        getPortStub.resolves(10050);

        const result = await runChromeDriver("130");

        assert.equal(result.gridUrl, "http://127.0.0.1:10050");
        assert.equal(result.port, 10050);
        assert.equal(result.process, processStub);
    });

    it("should pipe logs if debug is enabled", async () => {
        const result = await runChromeDriver("130", { debug: true });

        assert.calledOnceWith(spawnStub, "/driver/path", ["--port=12345", "--verbose"]);
        assert.calledOnceWith(pipeLogsWithPrefixStub, result.process, "[chromedriver@130] ");
    });

    it("should not pipe logs if debug is not enabled", async () => {
        await runChromeDriver("130");

        assert.notCalled(pipeLogsWithPrefixStub);
    });

    describe("ubuntu", () => {
        it(`should not try to install ubuntu packages if its not ubuntu`, async () => {
            isUbuntuStub.resolves(false);

            await runChromeDriver("130");

            assert.notCalled(installUbuntuPackageDependenciesStub);
        });

        it(`should not set ubuntu linker env variables if its not ubuntu`, async () => {
            installChromeDriverStub.resolves("/driver/path");
            getPortStub.resolves(10050);
            isUbuntuStub.resolves(false);

            await runChromeDriver("130");

            assert.notCalled(getUbuntuLinkerEnvStub);
            assert.calledOnceWith(spawnStub, sinon.match.string, sinon.match.array, {
                windowsHide: true,
                detached: false,
                env: process.env,
            });
        });

        it(`should set ubuntu linker env variables if its ubuntu`, async () => {
            isUbuntuStub.resolves(true);
            getUbuntuLinkerEnvStub.resolves({ foo: "bar" });

            await runChromeDriver("130");

            assert.calledOnceWith(spawnStub, sinon.match.string, sinon.match.array, {
                windowsHide: true,
                detached: false,
                env: {
                    ...process.env,
                    foo: "bar",
                },
            });
        });
    });
});
