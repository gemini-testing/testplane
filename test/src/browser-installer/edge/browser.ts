import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import { BrowserPlatform } from "@puppeteer/browsers";
import type { resolveEdgeVersion as ResolveEdgeVersionType } from "../../../../src/browser-installer/edge/browser";

describe("browser-installer/chrome/browser", () => {
    const sandbox = sinon.createSandbox();

    let resolveEdgeVersion: typeof ResolveEdgeVersionType;

    let execStub: SinonStub;
    let getBrowserPlatformStub: SinonStub;

    beforeEach(() => {
        execStub = sinon.stub();

        getBrowserPlatformStub = sinon.stub().returns(BrowserPlatform.LINUX);

        resolveEdgeVersion = proxyquire("../../../../src/browser-installer/edge/browser", {
            // eslint-disable-next-line camelcase
            child_process: { exec: execStub },
            "../utils": { getBrowserPlatform: getBrowserPlatformStub },
        }).resolveEdgeVersion;
    });

    afterEach(() => sandbox.restore());

    const execFailStub_ = (stub: SinonStub, err: Error): void => {
        stub.callsFake((_: string, cb: (err: Error) => void) => {
            cb(err);
        });
    };

    const execSuccessStub_ = (stub: SinonStub, stdout: string): void => {
        stub.callsFake((_: string, cb: (err: null, stdout: string) => void) => {
            cb(null, stdout);
        });
    };

    describe("resolveEdgeVersion", () => {
        it("should throw error if exec command has failed", async () => {
            execFailStub_(execStub, new Error("Can't run the command"));

            const errorMessage = "Couldn't retrive edge version. Looks like its not installed";
            await assert.isRejected(resolveEdgeVersion(), errorMessage);
        });

        it("should throw error if exec command returned invalid output", async () => {
            execSuccessStub_(execStub, "some invalid output");

            const errorMessage =
                'Couldn\'t retrive edge version. Expected browser version, but got "some invalid output"';
            await assert.isRejected(resolveEdgeVersion(), errorMessage);
        });

        it("should resolve windows output", async () => {
            const windowsSuccessOutput = `
            HKEY_CURRENT_USER\\Software\\Microsoft\\Edge\\BLBeacon
                version    REG_SZ    114.0.1823.67
            `;

            getBrowserPlatformStub.returns(BrowserPlatform.WIN64);
            execSuccessStub_(execStub, windowsSuccessOutput);

            const version = await resolveEdgeVersion();

            assert.equal(version, "114.0.1823.67");
        });

        it("should resolve linux output", async () => {
            const linuxSuccessOutput = "Microsoft Edge 131.0.2903.112";

            getBrowserPlatformStub.returns(BrowserPlatform.LINUX);
            execSuccessStub_(execStub, linuxSuccessOutput);

            const version = await resolveEdgeVersion();

            assert.equal(version, "131.0.2903.112");
        });

        it("should resolve mac output", async () => {
            const macOsSuccessOutput = "Microsoft Edge 131.0.2903.112";

            getBrowserPlatformStub.returns(BrowserPlatform.MAC);
            execSuccessStub_(execStub, macOsSuccessOutput);

            const version = await resolveEdgeVersion();

            assert.equal(version, "131.0.2903.112");
        });

        it("should memoize result", async () => {
            execSuccessStub_(execStub, "Microsoft Edge 131.0.2903.112");

            await resolveEdgeVersion();
            await resolveEdgeVersion();
            await resolveEdgeVersion();

            assert.calledOnce(execStub);
        });
    });
});
