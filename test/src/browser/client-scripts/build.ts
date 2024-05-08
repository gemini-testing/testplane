import sinon, { type SinonSpy, type SinonStub } from "sinon";
import browserify from "browserify";
import path from "path";
import fs from "fs-extra";

describe("client-scripts/build", () => {
    const sandbox = sinon.createSandbox();
    const targetDir = "build/src/browser/client-scripts";

    let ensureDirStub: SinonStub;
    let writeFileStub: SinonStub;
    let transformSpy: SinonSpy;

    beforeEach(() => {
        ensureDirStub = sandbox.stub(fs, "ensureDir").resolves();
        writeFileStub = sandbox.stub(fs, "writeFile").resolves();
        transformSpy = sandbox.spy(browserify.prototype, "transform");
    });

    afterEach(() => sandbox.restore());

    const buildClientScripts_ = async (): Promise<void> => {
        const clearRequire = require("clear-require"); // eslint-disable-line @typescript-eslint/no-var-requires
        const scriptPath = path.resolve(process.cwd(), "src", "browser", "client-scripts", "build");

        clearRequire(scriptPath);

        await require("../../../../src/browser/client-scripts/build");
    };

    const assertForNativeLibrary_ = (): void => {
        assert.calledWithMatch(transformSpy, {
            aliases: {
                "./lib": { relative: "./lib.native.js" },
            },
            verbose: false,
        });
        assert.calledWith(ensureDirStub, targetDir);
        assert.calledWith(writeFileStub, path.join(targetDir, "bundle.js"), sinon.match(Buffer));
    };

    const assertForCompatLibrary_ = (): void => {
        assert.calledWithMatch(transformSpy, {
            aliases: {
                "./lib": { relative: "./lib.compat.js" },
            },
            verbose: false,
        });
        assert.calledWith(ensureDirStub, targetDir);
        assert.calledWith(writeFileStub, path.join(targetDir, "bundle.compat.js"), sinon.match(Buffer));
    };

    it("should build bundles for compat and native library", async function () {
        this.timeout(10000);

        await buildClientScripts_();

        assertForNativeLibrary_();
        assertForCompatLibrary_();
    });
});
