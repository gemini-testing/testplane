import fs from "fs";
import path from "path";
import sinon, { type SinonStub } from "sinon";
import {ClientBridge} from "src/browser/client-bridge/client-bridge";
import { build as buildClientBridge } from "src/browser/client-bridge";

describe("clientBridge", () => {
    const sandbox = sinon.createSandbox();

    let readFileStub: SinonStub;
    let ClientBridgeCreateStub: SinonStub;

    beforeEach(() => {
        readFileStub = sandbox.stub(fs.promises, "readFile").resolves();
        ClientBridgeCreateStub = sandbox.stub(ClientBridge, "create");
    });

    afterEach(() => sandbox.restore());

    describe("build", () => {
        describe("should read correct bundle file", () => {
            it("using native library", async () => {
                readFileStub.withArgs(sinon.match.string, { encoding: "utf8" }).resolves("foo bar native script");
                ClientBridgeCreateStub.withArgs("browser", "foo bar native script").returns({ clientBridge: "native" });

                const result = await buildClientBridge("browser" as any);

                const fileName = path.basename(readFileStub.firstCall.args[0]);

                assert.equal(fileName, "bundle.native.js");
                assert.deepEqual(result, { clientBridge: "native" } as unknown as ClientBridge);
            });

            it("using compat library", async () => {
                readFileStub.withArgs(sinon.match.string, { encoding: "utf8" }).resolves("foo bar compat script");
                ClientBridgeCreateStub.withArgs("browser", "foo bar compat script").returns({ clientBridge: "compat" });

                const result = await buildClientBridge("browser" as any, { calibration: { needsCompatLib: true } });

                const fileName = path.basename(readFileStub.firstCall.args[0]);

                assert.equal(fileName, "bundle.compat.js");
                assert.deepEqual(result, { clientBridge: "compat" } as unknown as ClientBridge);
            });
        });
    });
});
