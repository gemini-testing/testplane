import sinon, { type SinonStub } from "sinon";
import { parse } from "acorn";
import path from "path";
import fs from "fs-extra";

describe("client-scripts/build", () => {
    const sandbox = sinon.createSandbox();

    let ensureDirStub: SinonStub;
    let writeFileStub: SinonStub;

    beforeEach(() => {
        ensureDirStub = sandbox.stub(fs, "ensureDir").resolves();
        writeFileStub = sandbox.stub(fs, "writeFile").resolves();
    });

    afterEach(() => sandbox.restore());

    const buildClientScripts_ = async (targetDir: string): Promise<void> => {
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

    for (const script of ["browser-utils", "screen-shooter"]) {
        it(`should build ${script} bundles with ES3 syntax for both libraries`, async function () {
            this.timeout(10000);

            const targetDir = path.resolve(process.cwd(), "src", "browser", "client-scripts", script);
            const buildDir = path.join(targetDir, "build");

            await buildClientScripts_(targetDir);

            assert.calledWith(ensureDirStub, buildDir);
            assert.calledTwice(writeFileStub);

            for (const library of ["native", "compat"]) {
                const bundlePath = path.join(buildDir, `bundle.${library}.js`);
                const call = writeFileStub.getCalls().find(call => call.args[0] === bundlePath);

                assert.isDefined(call, `missing ${bundlePath}`);
                const bundle = call!.args[1] as string;
                assert.isTrue(bundle.startsWith("(function (__geminiNamespace) {"));
                assert.isTrue(bundle.endsWith(")(arguments[0])"));

                parse(bundle, { ecmaVersion: 3, allowReserved: "never" });
            }
        });
    }
});
