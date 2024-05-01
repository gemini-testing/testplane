import fs from "fs-extra";
import sinon, { type SinonStub } from "sinon";
import proxyquire from "proxyquire";

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
        let loggerStub: { warn: SinonStub };

        beforeEach(() => {
            fsReadFileStub = sandbox.stub(fs, "readFile");
            fetchStub = sandbox.stub(globalThis, "fetch");

            formatErrorSnippetStub = sandbox.stub();
            findRelevantStackFrameStub = sandbox.stub();
            loggerStub = { warn: sandbox.stub() };

            extendWithCodeSnippet = proxyquire("../../../src/error-snippets", {
                "./utils": { formatErrorSnippet: formatErrorSnippetStub },
                "./frames": { findRelevantStackFrame: findRelevantStackFrameStub },
                "../utils/logger": loggerStub,
            }).extendWithCodeSnippet;
        });

        afterEach(() => sandbox.restore());

        it("should not modify error, if it is falsy", async () => {
            await assert.eventually.isUndefined(extendWithCodeSnippet());
            await assert.eventually.isNull(extendWithCodeSnippet(null));
            await assert.eventually.equal(extendWithCodeSnippet(""), "");

            assert.notCalled(loggerStub.warn);
        });

        it("should not modify error, if could not find relevant stack frame", async () => {
            const error = new Error("test error");
            const savedError = cloneError(error);
            findRelevantStackFrameStub.returns(null);

            await extendWithCodeSnippet(error);

            assert.notCalled(loggerStub.warn);
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
            assert.calledOnceWith(loggerStub.warn, "Unable to apply code snippet:");
        });

        it("should return the same Object.is object", async () => {
            const error = new Error("test error");
            const stackFrame = { fileName: "/file/file1", lineNumber: 100, columnNumber: 500 };
            findRelevantStackFrameStub.returns(stackFrame);
            formatErrorSnippetStub.returns("code snippet");
            fsReadFileStub.resolves("source code");

            const result = await extendWithCodeSnippet(error);

            assert.notCalled(loggerStub.warn);
            assert.equal(error, result);
        });

        it("should return error with snippet for file path", async () => {
            const error = new Error("test error");
            const stackFrame = { fileName: "/file/file1", lineNumber: 100, columnNumber: 500 };
            findRelevantStackFrameStub.returns(stackFrame);
            formatErrorSnippetStub.returns("code snippet");
            fsReadFileStub.resolves("source code");

            const result = await extendWithCodeSnippet(error);

            assert.notCalled(loggerStub.warn);
            assert.equal(result.snippet, "code snippet");
        });

        it("should return error with snippet for network url", async () => {
            const error = new Error("test error");
            const stackFrame = { fileName: "http://localhost:3000/file/file1", lineNumber: 100, columnNumber: 500 };
            findRelevantStackFrameStub.returns(stackFrame);
            formatErrorSnippetStub.returns("code snippet");
            fetchStub.withArgs("http://localhost:3000/file/file1").resolves({
                text: () => Promise.resolve("source code"),
                headers: new Map(),
            });

            const result = await extendWithCodeSnippet(error);

            assert.notCalled(loggerStub.warn);
            assert.equal(result.snippet, "code snippet");
        });

        it("should return error, if formatFileNameHeader fails", async () => {
            const error = new Error("test error");
            const stackFrame = { fileName: "/file/file1", lineNumber: 100, columnNumber: 500 };
            findRelevantStackFrameStub.returns(stackFrame);
            fsReadFileStub.returns("source code");
            formatErrorSnippetStub.throws(new Error());

            await extendWithCodeSnippet(error);

            assert.calledOnceWith(loggerStub.warn, "Unable to apply code snippet:");
        });
    });
});
