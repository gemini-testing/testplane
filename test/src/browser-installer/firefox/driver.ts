import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { installLatestGeckoDriver as InstallLatestGeckoDriverType } from "../../../../src/browser-installer/firefox/driver";
import { DriverName } from "../../../../src/browser-installer/utils";

describe("browser-installer/firefox/driver", () => {
    const sandbox = sinon.createSandbox();

    let installLatestGeckoDriver: typeof InstallLatestGeckoDriverType;

    let downloadGeckoDriverStub: SinonStub;
    let retryFetchStub: SinonStub;
    let getBinaryPathStub: SinonStub;
    let getMatchedDriverVersionStub: SinonStub;
    let installBinaryStub: SinonStub;

    beforeEach(() => {
        downloadGeckoDriverStub = sandbox.stub().resolves("/binary/path");
        retryFetchStub = sandbox.stub().resolves("result");
        getBinaryPathStub = sandbox.stub().resolves("/binary/path");
        getMatchedDriverVersionStub = sandbox.stub().returns(null);
        installBinaryStub = sandbox.stub();

        installLatestGeckoDriver = proxyquire("../../../../src/browser-installer/firefox/driver", {
            geckodriver: { download: downloadGeckoDriverStub },
            "../utils": {
                ...require("../../../../src/browser-installer/utils"),
                retryFetch: retryFetchStub,
            },
            "../registry": {
                default: {
                    getBinaryPath: getBinaryPathStub,
                    getMatchedDriverVersion: getMatchedDriverVersionStub,
                    installBinary: installBinaryStub,
                },
            },
        }).installLatestGeckoDriver;
    });

    afterEach(() => sandbox.restore());

    it("should try to resolve driver path locally by default", async () => {
        getMatchedDriverVersionStub.withArgs(DriverName.GECKODRIVER, sinon.match.string, "115").returns("115.0");
        getBinaryPathStub.withArgs(DriverName.GECKODRIVER, sinon.match.string, "115.0").returns("/driver/path");

        const driverPath = await installLatestGeckoDriver("115");

        assert.equal(driverPath, "/driver/path");
        assert.notCalled(retryFetchStub);
        assert.notCalled(installBinaryStub);
    });

    it("should not try to resolve driver path locally with 'force' flag", async () => {
        getMatchedDriverVersionStub.withArgs(DriverName.GECKODRIVER, sinon.match.string, "115").returns("115.0");
        retryFetchStub.withArgs("https://raw.githubusercontent.com/mozilla/geckodriver/release/Cargo.toml").resolves({
            text: () => Promise.resolve("version = '0.35.0'"),
        });
        installBinaryStub
            .withArgs(DriverName.GECKODRIVER, sinon.match.string, "0.35.0", sinon.match.func)
            .resolves("/new/downloaded/driver/path");

        const driverPath = await installLatestGeckoDriver("115", { force: true });

        assert.notCalled(getBinaryPathStub);
        assert.equal(driverPath, "/new/downloaded/driver/path");
    });

    it("should download driver if it is not downloaded", async () => {
        getMatchedDriverVersionStub.withArgs(DriverName.GECKODRIVER, sinon.match.string, "115").returns(null);
        retryFetchStub.withArgs("https://raw.githubusercontent.com/mozilla/geckodriver/release/Cargo.toml").resolves({
            text: () => Promise.resolve("version = '0.35.0'"),
        });
        installBinaryStub
            .withArgs(DriverName.GECKODRIVER, sinon.match.string, "0.35.0", sinon.match.func)
            .resolves("/new/downloaded/driver/path");

        const driverPath = await installLatestGeckoDriver("115");

        assert.equal(driverPath, "/new/downloaded/driver/path");
    });
});
