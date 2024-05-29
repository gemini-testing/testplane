import sinon, { type SinonStub } from "sinon";
import { SourceMapConsumer, type BasicSourceMapConsumer, type NullableMappedPosition } from "source-map";
import { extractSourceMaps, resolveLocationWithSourceMap } from "./../../../src/error-snippets/source-maps";
import type { SufficientStackFrame, ResolvedFrame } from "../../../src/error-snippets/types";

describe("error-snippets/source-maps", () => {
    const sandbox = sinon.createSandbox();

    let fetchStub: SinonStub;

    beforeEach(() => {
        fetchStub = sandbox.stub(globalThis, "fetch");
    });

    afterEach(() => sandbox.restore());

    describe("extractSourceMaps", () => {
        it("should return null if source maps comment is not present in file content", async () => {
            const fileContents = 'console.log("Hello, World!");';
            const fileName = "test.js";

            const result = await extractSourceMaps(fileContents, fileName);

            assert.isNull(result);
        });

        it("should return a SourceMapConsumer instance if source maps comment is present in file content", async () => {
            const inlineSourceMap =
                "data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IiJ9";
            const fileContents = `console.log("Hello, World!");\n//# sourceMappingURL=${inlineSourceMap}`;
            const fileName = "test.js";
            fetchStub.withArgs(inlineSourceMap).resolves({
                text: () => Promise.resolve('{"version":3,"sources":[],"names":[],"mappings":""}'),
                headers: new Map(),
            });

            const result = await extractSourceMaps(fileContents, fileName);

            assert.instanceOf(result, SourceMapConsumer);
        });
    });

    describe("resolveLocationWithSourceMap", () => {
        it("should throw an error when source is null", async () => {
            const sourceMaps = (await new SourceMapConsumer(
                JSON.stringify({
                    version: 3,
                    sources: [],
                    names: [],
                    mappings: "",
                }),
            )) as BasicSourceMapConsumer;
            const stackFrame = { lineNumber: 5, columnNumber: 10 } as SufficientStackFrame;

            const fn = (): ResolvedFrame => resolveLocationWithSourceMap(stackFrame, sourceMaps);

            assert.throw(fn, "File source code could not be evaluated from the source map");
        });

        it("should throw an error when line or column is null", async () => {
            const sourceMaps = (await new SourceMapConsumer(
                JSON.stringify({
                    version: 3,
                    sources: ["file1"],
                    names: [],
                    mappings: "",
                    sourcesContent: ["content"],
                }),
            )) as BasicSourceMapConsumer;
            sandbox.stub(sourceMaps, "originalPositionFor").returns({ source: "file1" } as NullableMappedPosition);
            const stackFrame = { lineNumber: 5, columnNumber: 10 } as SufficientStackFrame;

            const fn = (): ResolvedFrame => resolveLocationWithSourceMap(stackFrame, sourceMaps);

            assert.throw(fn, "Line and column could not be evaluated from the source map");
        });

        it("should return ResolvedFrame", async () => {
            const sourceMaps = (await new SourceMapConsumer(
                JSON.stringify({
                    version: 3,
                    sources: ["file1"],
                    names: [],
                    mappings: "AAAA;AACA",
                    sourcesContent: ["content"],
                }),
            )) as BasicSourceMapConsumer;
            sourceMaps.file = "file:///file1";
            sandbox
                .stub(sourceMaps, "originalPositionFor")
                .returns({ source: "file1", line: 100, column: 500 } as NullableMappedPosition);
            const stackFrame = { lineNumber: 1, columnNumber: 1 } as SufficientStackFrame;

            const result = resolveLocationWithSourceMap(stackFrame, sourceMaps);

            assert.deepEqual(result, { file: "/file1", source: "content", location: { line: 100, column: 500 } });
        });
    });
});
