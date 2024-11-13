import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { installEdgeDriver as InstallEdgeDriverType } from "../../../../src/browser-installer/edge/driver";
import { Driver } from "../../../../src/browser-installer/utils";

describe("browser-installer/edge/driver", () => {
    const sandbox = sinon.createSandbox();

    let installEdgeDriver: typeof InstallEdgeDriverType;

    let downloadEdgeDriverStub: SinonStub;
    let retryFetchStub: SinonStub;
    let getBinaryPathStub: SinonStub;
    let getMatchingDriverVersionStub: SinonStub;
    let installBinaryStub: SinonStub;

    beforeEach(() => {
        downloadEdgeDriverStub = sandbox.stub().resolves("/binary/path");
        retryFetchStub = sandbox.stub().resolves("result");
        getBinaryPathStub = sandbox.stub().resolves("/binary/path");
        getMatchingDriverVersionStub = sandbox.stub().returns(null);
        installBinaryStub = sandbox.stub();

        installEdgeDriver = proxyquire("../../../../src/browser-installer/edge/driver", {
            edgedriver: { download: downloadEdgeDriverStub },
            "../utils": {
                ...require("../../../../src/browser-installer/utils"),
                retryFetch: retryFetchStub,
            },
            "../registry": {
                getBinaryPath: getBinaryPathStub,
                getMatchingDriverVersion: getMatchingDriverVersionStub,
                installBinary: installBinaryStub,
            },
        }).installEdgeDriver;
    });

    afterEach(() => sandbox.restore());

    it("should try to resolve driver path locally without 'force' flag", async () => {
        getMatchingDriverVersionStub.withArgs(Driver.EDGEDRIVER, sinon.match.string, "115").returns("115.0");
        getBinaryPathStub.withArgs(Driver.EDGEDRIVER, sinon.match.string, "115.0").returns("/driver/path");

        const driverPath = await installEdgeDriver("115");

        assert.equal(driverPath, "/driver/path");
        assert.notCalled(retryFetchStub);
        assert.notCalled(installBinaryStub);
    });

    it("should not try to resolve driver path locally with 'force' flag", async () => {
        getMatchingDriverVersionStub.withArgs(Driver.EDGEDRIVER, sinon.match.string, "115").returns("115.0");
        getBinaryPathStub.withArgs(Driver.EDGEDRIVER, sinon.match.string, "115.0").returns("/driver/path");
        retryFetchStub.withArgs("https://msedgedriver.azureedge.net/LATEST_RELEASE_115").resolves({
            text: () => Promise.resolve("115.0.5678.170"),
        });
        installBinaryStub
            .withArgs(Driver.EDGEDRIVER, sinon.match.string, "115.0.5678.170", sinon.match.func)
            .resolves("/new/driver/path");

        const driverPath = await installEdgeDriver("115", { force: true });

        assert.equal(driverPath, "/new/driver/path");
    });

    it("should download driver if it is not downloaded", async () => {
        getMatchingDriverVersionStub.withArgs(Driver.EDGEDRIVER, sinon.match.string, "115").returns(null);
        retryFetchStub.withArgs("https://msedgedriver.azureedge.net/LATEST_RELEASE_115").resolves({
            text: () => Promise.resolve("115.0.5678.170"),
        });
        installBinaryStub
            .withArgs(Driver.EDGEDRIVER, sinon.match.string, "115.0.5678.170", sinon.match.func)
            .resolves("/new/driver/path");

        const driverPath = await installEdgeDriver("115");

        assert.equal(driverPath, "/new/driver/path");
    });

    it("should throw an error on unsupported old version", async () => {
        getMatchingDriverVersionStub.returns(null);

        await assert.isRejected(
            installEdgeDriver("35"),
            "Automatic driver downloader is not available for Edge versions < 94",
        );
        assert.notCalled(retryFetchStub);
        assert.notCalled(installBinaryStub);
    });
});
