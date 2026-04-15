import sinon, { type SinonSpy, type SinonStub } from "sinon";
import browserify from "browserify";
import path from "path";
import fs from "fs-extra";

describe("client-scripts/build", () => {
    const sandbox = sinon.createSandbox();
    const targetDir = path.resolve(process.cwd(), "src", "browser", "client-scripts", "browser-utils");
    const buildDir = path.join(targetDir, "build");

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
        const originalArgv = process.argv;

        clearRequire(scriptPath);
        process.argv = [...process.argv.slice(0, 2), targetDir];

        try {
            await require("../../../../src/browser/client-scripts/build");
        } finally {
            process.argv = originalArgv;
        }
    };

    const assertForNativeLibrary_ = (): void => {
        assert.calledWithMatch(transformSpy, {
            aliases: {
                "@lib": "./src/browser/client-scripts/browser-utils/tsc-out/client-scripts/shared/lib.native.js",
            },
            verbose: false,
        });
        assert.calledWith(ensureDirStub, buildDir);
        assert.calledWith(writeFileStub, path.join(buildDir, "bundle.native.js"), sinon.match.string);
    };

    const assertForCompatLibrary_ = (): void => {
        assert.calledWithMatch(transformSpy, {
            aliases: {
                "@lib": "./src/browser/client-scripts/browser-utils/tsc-out/client-scripts/shared/lib.compat.js",
            },
            verbose: false,
        });
        assert.calledWith(ensureDirStub, buildDir);
        assert.calledWith(writeFileStub, path.join(buildDir, "bundle.compat.js"), sinon.match.string);
    };

    it("should build bundles for compat and native library", async function () {
        this.timeout(10000);

        await buildClientScripts_();

        assertForNativeLibrary_();
        assertForCompatLibrary_();
    });
});
