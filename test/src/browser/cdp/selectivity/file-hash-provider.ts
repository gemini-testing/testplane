import sinon, { SinonStub } from "sinon";
import proxyquire from "proxyquire";
import { EventEmitter } from "events";

describe("CDP/Selectivity/FileHashProvider", () => {
    const sandbox = sinon.createSandbox();
    let FileHashProvider: typeof import("src/browser/cdp/selectivity/file-hash-provider").FileHashProvider;
    let cryptoStub: { createHash: SinonStub };
    let fsStub: { createReadStream: SinonStub };
    let hashMock: { update: SinonStub; digest: SinonStub };
    let streamMock: EventEmitter;

    beforeEach(() => {
        hashMock = {
            update: sandbox.stub(),
            digest: sandbox.stub().returns("mocked-hash-value"),
        };
        cryptoStub = {
            createHash: sandbox.stub().returns(hashMock),
        };
        streamMock = new EventEmitter();
        fsStub = {
            createReadStream: sandbox.stub().returns(streamMock),
        };

        FileHashProvider = proxyquire("src/browser/cdp/selectivity/file-hash-provider", {
            "node:crypto": cryptoStub,
            "node:fs": fsStub,
        }).FileHashProvider;
    });

    afterEach(() => {
        sandbox.restore();
        // Clear the static hash store between tests
        (FileHashProvider as any)._hashStore?.clear();
    });

    describe("calculateFor", () => {
        it("should calculate hash for a file", async () => {
            const filePath = "/path/to/file.js";
            const provider = new FileHashProvider();

            const hashPromise = provider.calculateFor(filePath);

            streamMock.emit("data", Buffer.from("chunk1"));
            streamMock.emit("data", Buffer.from("chunk2"));
            streamMock.emit("end");

            const result = await hashPromise;

            assert.equal(result, "mocked-hash-value");
            assert.calledOnceWith(cryptoStub.createHash, "md5");
            assert.calledOnceWith(fsStub.createReadStream, filePath);
            assert.calledTwice(hashMock.update);
            assert.calledWith(hashMock.update.firstCall, Buffer.from("chunk1"));
            assert.calledWith(hashMock.update.secondCall, Buffer.from("chunk2"));
            assert.calledOnceWith(hashMock.digest, "hex");
        });

        it("should return cached hash for the same file", async () => {
            const filePath = "/path/to/file.js";
            const provider = new FileHashProvider();

            // First call
            const firstPromise = provider.calculateFor(filePath);
            streamMock.emit("data", Buffer.from("data"));
            streamMock.emit("end");
            const firstResult = await firstPromise;

            // Second call
            const secondResult = await provider.calculateFor(filePath);

            assert.equal(firstResult, "mocked-hash-value");
            assert.equal(secondResult, "mocked-hash-value");
            assert.calledOnce(fsStub.createReadStream);
        });

        it("should handle file read errors", async () => {
            const filePath = "/path/to/nonexistent.js";
            const provider = new FileHashProvider();
            const error = new Error("ENOENT: no such file or directory");

            const hashPromise = provider.calculateFor(filePath);

            streamMock.emit("error", error);

            await assert.isRejected(
                hashPromise,
                /Selectivity: Couldn't calculate hash for \/path\/to\/nonexistent\.js: Error: ENOENT: no such file or directory/,
            );
        });

        it("should handle multiple concurrent requests for the same file", async () => {
            const filePath = "/path/to/file.js";
            const provider = new FileHashProvider();

            const promise1 = provider.calculateFor(filePath);
            const promise2 = provider.calculateFor(filePath);
            const promise3 = provider.calculateFor(filePath);

            streamMock.emit("data", Buffer.from("data"));
            streamMock.emit("end");

            const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

            assert.equal(result1, "mocked-hash-value");
            assert.equal(result2, "mocked-hash-value");
            assert.equal(result3, "mocked-hash-value");
            assert.calledOnce(fsStub.createReadStream);
        });

        it("should handle different files separately", async () => {
            const filePath1 = "/path/to/file1.js";
            const filePath2 = "/path/to/file2.js";
            const provider = new FileHashProvider();

            const streamMock1 = new EventEmitter();
            const streamMock2 = new EventEmitter();

            fsStub.createReadStream.callsFake((path: string) => {
                if (path === filePath1) {
                    return streamMock1;
                } else if (path === filePath2) {
                    return streamMock2;
                }
                return new EventEmitter();
            });

            hashMock.digest.onFirstCall().returns("hash1").onSecondCall().returns("hash2");

            const promise1 = provider.calculateFor(filePath1);
            const promise2 = provider.calculateFor(filePath2);

            streamMock1.emit("data", Buffer.from("data1"));
            streamMock1.emit("end");
            streamMock2.emit("data", Buffer.from("data2"));
            streamMock2.emit("end");

            const [result1, result2] = await Promise.all([promise1, promise2]);

            assert.equal(result1, "hash1");
            assert.equal(result2, "hash2");
            assert.calledTwice(fsStub.createReadStream);
            assert.calledWith(fsStub.createReadStream.firstCall, filePath1);
            assert.calledWith(fsStub.createReadStream.secondCall, filePath2);
        });

        it("should create new hash instance for each file", async () => {
            const filePath1 = "/path/to/file1.js";
            const filePath2 = "/path/to/file2.js";
            const provider = new FileHashProvider();

            const hash1Mock = { update: sandbox.stub(), digest: sandbox.stub().returns("hash1") };
            const hash2Mock = { update: sandbox.stub(), digest: sandbox.stub().returns("hash2") };

            cryptoStub.createHash.onFirstCall().returns(hash1Mock).onSecondCall().returns(hash2Mock);

            const streamMock1 = new EventEmitter();
            const streamMock2 = new EventEmitter();

            fsStub.createReadStream.callsFake((path: string) => {
                if (path === filePath1) {
                    return streamMock1;
                } else if (path === filePath2) {
                    return streamMock2;
                }
                return new EventEmitter();
            });

            const promise1 = provider.calculateFor(filePath1);
            const promise2 = provider.calculateFor(filePath2);

            streamMock1.emit("data", Buffer.from("data1"));
            streamMock1.emit("end");
            streamMock2.emit("data", Buffer.from("data2"));
            streamMock2.emit("end");

            const [result1, result2] = await Promise.all([promise1, promise2]);

            assert.equal(result1, "hash1");
            assert.equal(result2, "hash2");
            assert.calledTwice(cryptoStub.createHash);
            assert.calledWith(hash1Mock.update, Buffer.from("data1"));
            assert.calledWith(hash2Mock.update, Buffer.from("data2"));
        });
    });
});
