import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { resolveSafariVersion as ResolveSafariVersionType } from "../../../../src/browser-installer/safari/browser";

describe("browser-installer/chrome/browser", () => {
    const sandbox = sinon.createSandbox();

    let resolveSafariVersion: typeof ResolveSafariVersionType;

    let execStub: SinonStub;

    beforeEach(() => {
        execStub = sinon.stub();

        resolveSafariVersion = proxyquire("../../../../src/browser-installer/safari/browser", {
            // eslint-disable-next-line camelcase
            child_process: { exec: execStub },
        }).resolveSafariVersion;
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

            const errorMessage = "Couldn't retrive safari version.";
            await assert.isRejected(resolveSafariVersion(), errorMessage);
        });

        it("should throw error if exec command returned invalid output", async () => {
            execSuccessStub_(execStub, "some invalid output");

            const errorMessage = "Couldn't retrive safari version.";
            await assert.isRejected(resolveSafariVersion(), errorMessage);
        });

        it("should resolve safari version", async () => {
            const successOutput = 'kMDItemVersion = "16.4"';

            execSuccessStub_(execStub, successOutput);

            const version = await resolveSafariVersion();

            assert.equal(version, "16.4");
        });

        it("should memoize result", async () => {
            execSuccessStub_(execStub, 'kMDItemVersion = "16.4"');

            await resolveSafariVersion();
            await resolveSafariVersion();

            assert.calledOnce(execStub);
        });
    });
});
