import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sinon from "sinon";
import { transformSourceDependencies } from "src/browser/cdp/selectivity/utils";

describe("CDP/Selectivity/dependency path compatibility", () => {
    let fixture: string;
    let localPath: string;

    beforeEach(() => {
        fixture = fs.mkdtempSync(path.join(os.tmpdir(), "testplane-dependency-paths-"));
        for (const name of ["style.css", "style%.css", "style%20.css", "style .css", "style name.css"]) {
            fs.writeFileSync(path.join(fixture, name), ".fixture { padding: 3px; }\n");
        }
        localPath = path.relative(process.cwd(), path.join(fixture, "style.css")).split(path.sep).join("/");
    });

    afterEach(() => {
        fs.rmSync(fixture, { recursive: true, force: true });
    });

    for (const protocol of ["http", "https", "webpack", "runtime"]) {
        it(`should allow an explicit mapper to resolve a ${protocol} CSS original`, () => {
            const remotePath = `${protocol}://assets.example/workspace/style.css`;
            const mapper = sinon.stub().returns(localPath);
            const result = transformSourceDependencies(
                { css: new Set([remotePath]), js: null, png: null },
                mapper,
                "browser",
            );

            assert.deepEqual(result.css, [localPath]);
            assert.calledOnceWithExactly(mapper, {
                scope: "browser",
                reason: "browser-css-import",
                relativePath: remotePath,
            });
        });
    }

    for (const protocol of ["http", "https", "webpack", "runtime"]) {
        it(`should preserve suppression when an identity mapper leaves a ${protocol} URI`, () => {
            const original = `${protocol}://assets.example/workspace/style.css`;
            const mapper = sinon.spy(({ relativePath }: { relativePath: string }) => relativePath);
            const result = transformSourceDependencies(
                { css: new Set([original]), js: null, png: null },
                mapper,
                "browser",
            );

            assert.deepEqual(result.css, []);
            assert.calledOnce(mapper);
        });
    }

    it("should suppress an unsupported URI returned by a mapper without treating it as a physical file", () => {
        const result = transformSourceDependencies(
            { css: new Set(["runtime://generated/style.css"]), js: null, png: null },
            () => "https://assets.example/style.css",
            "browser",
        );

        assert.deepEqual(result.css, []);
    });

    for (const mappedResult of [true, false, undefined]) {
        it(`should preserve protocol suppression when the mapper returns ${String(mappedResult)}`, () => {
            const mapper = sinon.stub().returns(mappedResult);
            const result = transformSourceDependencies(
                { css: new Set(["https://assets.example/style.css"]), js: null, png: null },
                mapper,
                "browser",
            );

            assert.deepEqual(result.css, []);
            assert.calledOnce(mapper);
        });
    }

    it("should preserve suppression of unmapped unsupported protocols", () => {
        const result = transformSourceDependencies(
            { css: new Set(["https://assets.example/style.css"]), js: null, png: null },
            null,
            "browser",
        );

        assert.deepEqual(result.css, []);
    });

    it("should propagate an explicit mapper's error for a protocol original", () => {
        assert.throws(
            () =>
                transformSourceDependencies(
                    { css: new Set(["https://assets.example/style.css"]), js: null, png: null },
                    () => {
                        throw new Error("Mapping failed");
                    },
                    "browser",
                ),
            /Mapping failed/,
        );
    });

    it("should reject a missing physical file returned by a protocol mapper", () => {
        assert.throws(
            () =>
                transformSourceDependencies(
                    { css: new Set(["https://assets.example/style.css"]), js: null, png: null },
                    () => `${localPath}.missing`,
                    "browser",
                ),
            /Selectivity: Couldn't find/,
        );
    });

    for (const name of ["style%.css", "style%20.css", "style name.css"]) {
        it(`should decode a file URL exactly once for ${name}`, () => {
            const file = path.join(fixture, name);
            const relativePath = path.relative(process.cwd(), file).split(path.sep).join("/");
            const result = transformSourceDependencies(
                { css: new Set([pathToFileURL(file).href]), js: null, png: null },
                null,
                "browser",
            );

            assert.deepEqual(result.css, [relativePath]);
        });
    }

    it("should continue decoding URI-encoded ordinary paths once", () => {
        const file = path.join(fixture, "style name.css");
        const encoded = path.join(fixture, "style%20name.css").split(path.sep).join("/");
        const result = transformSourceDependencies({ css: new Set([encoded]), js: null, png: null }, null, "browser");

        assert.deepEqual(result.css, [path.relative(process.cwd(), file).split(path.sep).join("/")]);
    });

    it("should not hide malformed escapes in ordinary paths", () => {
        assert.throws(
            () =>
                transformSourceDependencies(
                    { css: new Set([path.join(fixture, "style%ZZ.css")]), js: null, png: null },
                    null,
                    "browser",
                ),
            URIError,
        );
    });
});
