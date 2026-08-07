import sinon, { type SinonStub } from "sinon";
import { parse } from "@babel/parser";
import path from "path";
import fs from "fs-extra";

type AstNode = { type: string; [key: string]: unknown };

describe("client-scripts/build", () => {
    const sandbox = sinon.createSandbox();
    const targetDir = path.resolve(process.cwd(), "src", "browser", "client-scripts", "browser-utils");
    const buildDir = path.join(targetDir, "build");

    let ensureDirStub: SinonStub;
    let writeFileStub: SinonStub;

    beforeEach(() => {
        ensureDirStub = sandbox.stub(fs, "ensureDir").resolves();
        writeFileStub = sandbox.stub(fs, "writeFile").resolves();
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
        assert.calledWith(ensureDirStub, buildDir);
        assert.calledWith(
            writeFileStub,
            path.join(buildDir, "bundle.native.js"),
            sinon.match(
                (value: string) =>
                    value.startsWith("(function (__geminiNamespace) {") && value.endsWith(")(arguments[0])"),
            ),
        );
    };

    const assertForCompatLibrary_ = (): void => {
        assert.calledWith(ensureDirStub, buildDir);
        assert.calledWith(
            writeFileStub,
            path.join(buildDir, "bundle.compat.js"),
            sinon.match((value: string) => {
                if (!value.startsWith("(function (__geminiNamespace) {") || !value.endsWith(")(arguments[0])")) {
                    return false;
                }

                const ast = parse(value, { sourceType: "script" });
                const nodes = [ast.program as unknown as AstNode];

                while (nodes.length) {
                    const node = nodes.pop() as AstNode;

                    if (
                        node.type === "ArrowFunctionExpression" ||
                        node.type === "ClassDeclaration" ||
                        node.type === "ClassExpression" ||
                        (node.type === "VariableDeclaration" && node.kind !== "var")
                    ) {
                        return false;
                    }

                    for (const value of Object.values(node)) {
                        if (Array.isArray(value)) {
                            nodes.push(
                                ...value.filter((item): item is AstNode =>
                                    Boolean(item && typeof item === "object" && item.type),
                                ),
                            );
                        } else if (value && typeof value === "object" && "type" in value) {
                            nodes.push(value as AstNode);
                        }
                    }
                }

                return true;
            }),
        );
    };

    it("should build bundles for compat and native library", async function () {
        this.timeout(10000);

        await buildClientScripts_();

        assertForNativeLibrary_();
        assertForCompatLibrary_();
    });
});
