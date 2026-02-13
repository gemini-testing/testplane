import fs from "fs-extra";
import sinon, { type SinonStub } from "sinon";
import proxyquire from "proxyquire";

import { AssertViewError } from "../../../src/browser/commands/assert-view/errors/assert-view-error";
import { BaseStateError } from "../../../src/browser/commands/assert-view/errors/base-state-error";

describe("error-snippets", () => {
    const cloneError = (err: Error): Error => {
        const newError = err;

        newError.name = err.name;
        newError.message = err.message;
        newError.stack = err.stack;

        return newError;
    };

    describe("extendWithCodeSnippet", () => {
        const sandbox = sinon.createSandbox();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let extendWithCodeSnippet: (err?: any) => Promise<Error & { snippet?: string }>;
        let fsReadFileStub: SinonStub;
        let fetchStub: SinonStub;
        let formatErrorSnippetStub: SinonStub;
        let findRelevantStackFrameStub: SinonStub;
        let extractSourceMapsStub: SinonStub;
        let resolveLocationWithSourceMap: SinonStub;

        beforeEach(() => {
            fsReadFileStub = sandbox.stub(fs, "readFile");
            fetchStub = sandbox.stub(globalThis, "fetch").resolves({
                text: () => Promise.resolve("source code"),
                headers: new Map() as unknown as Headers,
            } as Response);
            formatErrorSnippetStub = sandbox.stub();
            findRelevantStackFrameStub = sandbox.stub();
            extractSourceMapsStub = sandbox.stub().resolves(null);
            resolveLocationWithSourceMap = sandbox.stub();

            extendWithCodeSnippet = proxyquire("../../../src/error-snippets", {
                "./utils": { formatErrorSnippet: formatErrorSnippetStub },
                "./frames": { findRelevantStackFrame: findRelevantStackFrameStub },
                "./source-maps": {
                    extractSourceMaps: extractSourceMapsStub,
                    resolveLocationWithSourceMap: resolveLocationWithSourceMap,
                },
            }).extendWithCodeSnippet;
        });

        afterEach(() => sandbox.restore());

        [AssertViewError, BaseStateError].forEach(ErrorClass => {
            it(`should not add error snippet for ${ErrorClass.name}`, async () => {
                const error = new ErrorClass(
                    "foo",
                    { path: "/some/path", size: { width: 800, height: 600 } },
                    { path: "/some/path", relativePath: "../path", size: { width: 800, height: 600 } },
                );
                const originalStack = error.stack;

                const result = await extendWithCodeSnippet(error);

                assert.isUndefined(result.snippet, originalStack);
            });
        });

        it("should not modify error, if it is falsy", async () => {
            await assert.eventually.isUndefined(extendWithCodeSnippet());
            await assert.eventually.isNull(extendWithCodeSnippet(null));
            await assert.eventually.equal(extendWithCodeSnippet(""), "");
        });

        it("should not modify error, if could not find relevant stack frame", async () => {
            const error = new Error("test error");
            const savedError = cloneError(error);
            findRelevantStackFrameStub.returns(null);

            await extendWithCodeSnippet(error);

            assert.strictEqual(error, savedError);
        });

        it("should not modify error, if stack frame resolver fails", async () => {
            const error = new Error("test error");
            const savedError = cloneError(error);
            const stackFrame = { fileName: "/foo/file1" };
            findRelevantStackFrameStub.returns(stackFrame);
            fsReadFileStub.withArgs("/foo/file1").rejects(new Error("read file error"));

            const result = await extendWithCodeSnippet(error);

            assert.strictEqual(error, savedError);
            assert.strictEqual(error, result);
        });

        it("should return the same Object.is object", async () => {
            const error = new Error("test error");
            const stackFrame = { fileName: "/file/file1", lineNumber: 100, columnNumber: 500 };
            findRelevantStackFrameStub.returns(stackFrame);
            formatErrorSnippetStub.returns("code snippet");
            fsReadFileStub.resolves("source code");

            const result = await extendWithCodeSnippet(error);

            assert.equal(error, result);
        });

        it("should return error with snippet for file path for esm file from stacktrace", async () => {
            const error = new Error("test error");
            const stackFrame = { fileName: "file:///file/file1", lineNumber: 100, columnNumber: 500 };
            findRelevantStackFrameStub.returns(stackFrame);
            extractSourceMapsStub.resolves(null);
            formatErrorSnippetStub.returns("code snippet");
            fsReadFileStub.resolves("async function main() {}");

            const result = await extendWithCodeSnippet(error);

            assert.equal(result.snippet, "code snippet");
        });

        it("should return error with snippet for network url from source maps", async () => {
            const error = new Error("test error");
            const stackFrame = { fileName: "http://localhost:3000/file/file1", lineNumber: 100, columnNumber: 500 };
            const resolvedLocation = {
                file: "file/file1",
                source: "source code",
                location: {},
            };
            findRelevantStackFrameStub.returns(stackFrame);
            fetchStub.withArgs("http://localhost:3000/file/file1").resolves({
                text: () => Promise.resolve("source code"),
                headers: new Map(),
            });
            extractSourceMapsStub.resolves("source-maps");
            resolveLocationWithSourceMap.withArgs(stackFrame, "source-maps").resolves(resolvedLocation);
            formatErrorSnippetStub.withArgs(error, resolvedLocation).returns("code snippet");

            const result = await extendWithCodeSnippet(error);

            assert.equal(result.snippet, "code snippet");
        });

        it("should return error, if formatFileNameHeader fails", async () => {
            const error = new Error("test error");
            const stackFrame = { fileName: "/file/file1", lineNumber: 100, columnNumber: 500 };
            findRelevantStackFrameStub.returns(stackFrame);
            fsReadFileStub.returns("source code");
            formatErrorSnippetStub.throws(new Error());

            const returnedError = await extendWithCodeSnippet(error);

            assert.strictEqual(error, returnedError);
        });
    });
});
