import path from "path";
import sinon from "sinon";
import url from "url";
import fs from "fs-extra";
import { formatFileNameHeader, getSourceCodeFile, formatErrorSnippet } from "../../../src/error-snippets/utils";
import { softFileURLToPath } from "../../../src/utils/fs";
import type { codeFrameColumns } from "@babel/code-frame";

const codeFrame = require("@babel/code-frame"); // eslint-disable-line @typescript-eslint/no-var-requires

const withGray = (line: string): string => "\x1B[90m" + line + "\x1B[39m";

describe("error-snippets/utils", () => {
    const sandbox = sinon.createSandbox();

    afterEach(() => sandbox.restore());

    describe("softFileURLToPath", () => {
        it("should return same fileName if it does not start with 'file://'", () => {
            const file = "data/myFile.txt";

            const result = softFileURLToPath(file);

            assert.equal(result, file);
        });

        it("should convert file URL to path if fileName starts with 'file://'", () => {
            const file = "file:///data/myFile.txt";

            const result = softFileURLToPath(file);

            assert.equal(result, "/data/myFile.txt");
        });

        it("should return same fileName if it starts with 'file://' but conversion fails", () => {
            sandbox.stub(url, "fileURLToPath").throws(new Error("foo"));
            const file = "file://invalid/path.txt";

            const result = softFileURLToPath(file);

            assert.equal(result, file);
        });
    });

    describe("formatFileNameHeader", () => {
        it("should handle line Offset correctly", () => {
            const fileName = "myFile.txt";

            const opts = {
                line: 10,
                linesAbove: 5,
                linesBelow: 5,
            };

            const result = formatFileNameHeader(fileName, opts);
            const expectedLine1 = `\x1B[90m   . | // myFile.txt\x1B[39m\n`;
            const expectedLine2 = `\x1B[90m   . |\x1B[39m\n`;
            const expected = expectedLine1 + expectedLine2;

            assert.equal(result, expected);
        });

        it("should return correct format for different options", () => {
            const opts = {
                line: 100,
                linesAbove: 50,
                linesBelow: 50,
            };

            const result = formatFileNameHeader("myFile.txt", opts);
            const expected = ["   .. | // myFile.txt", "   .. |"]
                .map(withGray)
                .map(line => line + "\n")
                .join("");

            assert.equal(result, expected);
        });
    });

    describe("formatErrorSnippet", () => {
        let codeFrameColumnsStub: typeof codeFrameColumns;

        beforeEach(() => {
            codeFrameColumnsStub = sandbox.stub(codeFrame, "codeFrameColumns").returns("code snippet");
        });

        it("should pass right args to codeFrameColumns", () => {
            const err = new Error("foo");

            formatErrorSnippet(err, {
                file: "file",
                source: "source",
                location: { line: 100, column: 500 },
            });

            assert.calledOnceWith(
                codeFrameColumnsStub,
                "source",
                { start: { line: 100, column: 500 } },
                {
                    linesAbove: 2,
                    linesBelow: 3,
                    message: "Error: foo",
                    highlightCode: true,
                    forceColor: true,
                },
            );
        });

        it("should start and end with a new line", () => {
            const err = new Error("foo");

            const snippet = formatErrorSnippet(err, {
                file: "file",
                source: "source",
                location: { line: 100, column: 500 },
            });

            assert.isTrue(snippet.startsWith("\n"));
            assert.isTrue(snippet.endsWith("\n"));
        });

        it("should include formatted relative file name", () => {
            sandbox.stub(path, "isAbsolute").returns(true);
            sandbox.stub(path, "relative").returns("relative-file-path");
            const err = new Error("foo");

            const snippet = formatErrorSnippet(err, {
                file: "file",
                source: "source",
                location: { line: 100, column: 500 },
            });

            assert.isTrue(snippet.includes("| // relative-file-path"));
        });
    });

    describe("getSourceCodeFile", () => {
        let fetchStub: sinon.SinonStub;
        let fsReadFileStub: sinon.SinonStub;

        beforeEach(() => {
            fetchStub = sandbox.stub(globalThis, "fetch");
            fsReadFileStub = sandbox.stub(fs, "readFile");
        });

        it("should read from file if file is absolute path", async () => {
            const absolutePath = "/foo/code.js";
            const fileContent = "bar";
            fsReadFileStub.withArgs("/foo/code.js").resolves(fileContent);

            const response = await getSourceCodeFile(absolutePath);

            assert.equal(response, fileContent);
            assert.notCalled(fetchStub);
        });

        it("should fetch if file is URL", async () => {
            const url = "http://example.com/code.js";
            const fileContent = "Hello, World!";
            fetchStub.withArgs(url).resolves({
                headers: new Map(),
                text: () => Promise.resolve(fileContent),
            });

            const result = await getSourceCodeFile(url);

            assert.calledOnceWith(fetchStub, url);
            assert.equal(result, fileContent);
        });

        it("should fetch with resolving SourceMap header if file is URL", async () => {
            const url = "http://example.com/code.js";
            const fileContent = "Hello, World!";
            const headers = new Headers();
            headers.append("SourceMap", "source-map.js.map");
            const response = new Response(fileContent, { headers });
            fetchStub.resolves(response);

            const result = await getSourceCodeFile(url);

            assert.equal(result, "Hello, World!\n//# sourceMappingURL=source-map.js.map");
        });

        it("should return response text if response text includes sourceMappingURL", async () => {
            const url = "http://example.com/code.js";
            const fileContent = `"Hello, World!\n//# sourceMappingURL=some-source-map.js.map"`;
            const headers = new Headers();
            headers.append("SourceMap", "another-source-map.js.map");
            const response = new Response(fileContent, { headers });
            fetchStub.resolves(response);

            const result = await getSourceCodeFile(url);

            assert.equal(result, fileContent);
        });
    });
});
