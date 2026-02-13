import sinon, { SinonStub } from "sinon";
import proxyquire from "proxyquire";

describe("CDP/Selectivity/FsCache", () => {
    const sandbox = sinon.createSandbox();
    let hasCachedSelectivityFile: typeof import("src/browser/cdp/selectivity/fs-cache").hasCachedSelectivityFile;
    let getCachedSelectivityFile: typeof import("src/browser/cdp/selectivity/fs-cache").getCachedSelectivityFile;
    let setCachedSelectivityFile: typeof import("src/browser/cdp/selectivity/fs-cache").setCachedSelectivityFile;
    let CacheType: typeof import("src/browser/cdp/selectivity/fs-cache").CacheType;

    let osStub: { tmpdir: SinonStub };
    let pathStub: { join: SinonStub };
    let lockfileStub: { lock: SinonStub };
    let fsStub: { ensureDir: SinonStub; stat: SinonStub; readFile: SinonStub; writeFile: SinonStub };
    let getMD5Stub: SinonStub;
    let debugSelectivityStub: SinonStub;

    const SELECTIVITY_CACHE_DIRECTIRY = "testplane-selectivity-cache";
    const SELECTIVITY_CACHE_READY_SUFFIX = "-ready";

    beforeEach(() => {
        osStub = {
            tmpdir: sandbox.stub().returns("/tmp"),
        };
        pathStub = {
            join: sandbox.stub().callsFake((...args) => args.join("/")),
        };
        lockfileStub = {
            lock: sandbox.stub(),
        };
        fsStub = {
            ensureDir: sandbox.stub().resolves(),
            stat: sandbox.stub(),
            readFile: sandbox.stub().resolves(),
            writeFile: sandbox.stub().resolves(),
        };
        getMD5Stub = sandbox.stub().callsFake((str: string) => `hash-of-${str}`);
        debugSelectivityStub = sandbox.stub();

        const proxyquiredModule = proxyquire("src/browser/cdp/selectivity/fs-cache", {
            "node:os": osStub,
            "node:path": pathStub,
            "proper-lockfile": lockfileStub,
            "fs-extra": fsStub,
            "../../../utils/crypto": { getMD5: getMD5Stub },
            "./constants": {
                SELECTIVITY_CACHE_DIRECTIRY,
                SELECTIVITY_CACHE_READY_SUFFIX,
            },
            "./debug": { debugSelectivity: debugSelectivityStub },
        });

        hasCachedSelectivityFile = proxyquiredModule.hasCachedSelectivityFile;
        getCachedSelectivityFile = proxyquiredModule.getCachedSelectivityFile;
        setCachedSelectivityFile = proxyquiredModule.setCachedSelectivityFile;
        CacheType = proxyquiredModule.CacheType;
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("hasCachedSelectivityFile", () => {
        it("should return true if flag file was modified after process start", async () => {
            const key = "test-key";
            const cacheType = CacheType.TestFile;
            const futureTime = Date.now() + 10000;

            fsStub.stat.resolves({ mtimeMs: futureTime });

            const result = await hasCachedSelectivityFile(cacheType, key);

            assert.isTrue(result);
            assert.calledWith(getMD5Stub, key);
            assert.calledWith(
                fsStub.stat,
                `/tmp/${SELECTIVITY_CACHE_DIRECTIRY}/thash-of-${key}${SELECTIVITY_CACHE_READY_SUFFIX}`,
            );
        });

        it("should return false if flag file was modified before process start", async () => {
            const key = "test-key";
            const cacheType = CacheType.Asset;
            const pastTime = 0;

            fsStub.stat.resolves({ mtimeMs: pastTime });

            const result = await hasCachedSelectivityFile(cacheType, key);

            assert.isFalse(result);
        });

        it("should return false if flag file does not exist", async () => {
            const key = "nonexistent-key";
            const cacheType = CacheType.TestFile;

            fsStub.stat.rejects(new Error("ENOENT: no such file or directory"));

            const result = await hasCachedSelectivityFile(cacheType, key);

            assert.isFalse(result);
        });

        it("should use correct cache type prefix", async () => {
            const key = "asset-key";
            const cacheType = CacheType.Asset;
            const futureTime = Date.now() + 10000;

            fsStub.stat.resolves({ mtimeMs: futureTime });

            await hasCachedSelectivityFile(cacheType, key);

            assert.calledWith(
                fsStub.stat,
                `/tmp/${SELECTIVITY_CACHE_DIRECTIRY}/ahash-of-${key}${SELECTIVITY_CACHE_READY_SUFFIX}`,
            );
        });
    });

    describe("getCachedSelectivityFile", () => {
        it("should return cached content if flag file is ready", async () => {
            const key = "test-key";
            const cacheType = CacheType.TestFile;
            const futureTime = Date.now() + 10000;
            const cachedContent = "cached content";

            fsStub.stat.resolves({ mtimeMs: futureTime });
            fsStub.readFile.resolves(cachedContent);

            const result = await getCachedSelectivityFile(cacheType, key);

            assert.equal(result, cachedContent);
            assert.calledWith(fsStub.readFile, `/tmp/${SELECTIVITY_CACHE_DIRECTIRY}/thash-of-${key}`, "utf8");
        });

        it("should return null if flag file is not ready", async () => {
            const key = "test-key";
            const cacheType = CacheType.TestFile;
            const pastTime = 0;

            fsStub.stat.resolves({ mtimeMs: pastTime });

            const result = await getCachedSelectivityFile(cacheType, key);

            assert.isNull(result);
            assert.notCalled(fsStub.readFile);
        });

        it("should return null if readFile fails", async () => {
            const key = "test-key";
            const cacheType = CacheType.Asset;
            const futureTime = Date.now() + 10000;

            fsStub.stat.resolves({ mtimeMs: futureTime });
            fsStub.readFile.rejects(new Error("Read error"));

            const result = await getCachedSelectivityFile(cacheType, key);

            assert.isNull(result);
        });

        it("should wait and retry if cache file is being written", async () => {
            const key = "test-key";
            const cacheType = CacheType.TestFile;
            const futureTime = Date.now() + 10000;
            const pastTime = 0;
            const cachedContent = "cached content";

            fsStub.stat
                .onFirstCall()
                .resolves({ mtimeMs: pastTime }) // Flag not ready
                .onSecondCall()
                .resolves({ mtimeMs: futureTime }) // Cache file exists (being written)
                .onThirdCall()
                .resolves({ mtimeMs: futureTime }); // Flag ready after retry

            fsStub.readFile.resolves(cachedContent);

            const result = await getCachedSelectivityFile(cacheType, key);

            assert.equal(result, cachedContent);
            assert.calledThrice(fsStub.stat);
        });

        it("should retry multiple times before giving up", async () => {
            const key = "test-key";
            const cacheType = CacheType.TestFile;
            const futureTime = Date.now() + 10000;
            const pastTime = 0;

            fsStub.stat.onCall(0).resolves({ mtimeMs: pastTime }); // flag
            fsStub.stat.onCall(1).resolves({ mtimeMs: futureTime }); // file
            fsStub.stat.onCall(2).resolves({ mtimeMs: pastTime }); // flag
            fsStub.stat.onCall(3).resolves({ mtimeMs: futureTime }); // flag
            fsStub.readFile.resolves("cache-contents");

            const result = await getCachedSelectivityFile(cacheType, key);

            assert.callCount(fsStub.stat, 4);
            assert.equal(result, "cache-contents");
        });
    });

    describe("setCachedSelectivityFile", () => {
        it("should write cache and flag files if not already cached", async () => {
            const key = "test-key";
            const cacheType = CacheType.TestFile;
            const content = "test content";
            const pastTime = 0;
            const releaseLockStub = sandbox.stub().resolves();

            fsStub.stat.resolves({ mtimeMs: pastTime });
            lockfileStub.lock.resolves(releaseLockStub);

            await setCachedSelectivityFile(cacheType, key, content);

            assert.calledWith(fsStub.ensureDir, `/tmp/${SELECTIVITY_CACHE_DIRECTIRY}`);
            assert.calledWith(lockfileStub.lock, `/tmp/${SELECTIVITY_CACHE_DIRECTIRY}/thash-of-${key}-ready`, {
                stale: 5000,
                update: 1000,
                retries: { minTimeout: 50, maxTimeout: 50, retries: 1 },
                realpath: false,
            });
            assert.calledWith(fsStub.writeFile, `/tmp/${SELECTIVITY_CACHE_DIRECTIRY}/thash-of-${key}`, content, {
                encoding: "utf8",
            });
            assert.calledWith(fsStub.writeFile, `/tmp/${SELECTIVITY_CACHE_DIRECTIRY}/thash-of-${key}-ready`, "");
            assert.calledOnce(releaseLockStub);
        });

        it("should not write if cache already exists", async () => {
            const key = "test-key";
            const cacheType = CacheType.Asset;
            const content = "test content";
            const futureTime = Date.now() + 10000;

            fsStub.stat.resolves({ mtimeMs: futureTime });

            await setCachedSelectivityFile(cacheType, key, content);

            assert.notCalled(fsStub.ensureDir);
            assert.notCalled(lockfileStub.lock);
            assert.notCalled(fsStub.writeFile);
        });

        it("should not write if lock acquisition fails", async () => {
            const key = "test-key";
            const cacheType = CacheType.TestFile;
            const content = "test content";
            const pastTime = 0;

            fsStub.stat.resolves({ mtimeMs: pastTime });
            lockfileStub.lock.resolves(null); // Lock acquisition failed

            await setCachedSelectivityFile(cacheType, key, content);

            assert.calledOnce(fsStub.ensureDir);
            assert.calledOnce(lockfileStub.lock);
            assert.notCalled(fsStub.writeFile);
        });

        it("should not write if cache was created while acquiring lock", async () => {
            const key = "test-key";
            const cacheType = CacheType.Asset;
            const content = "test content";
            const pastTime = 0;
            const futureTime = Date.now() + 10000;
            const releaseLockStub = sandbox.stub().resolves();

            fsStub.stat.onCall(0).resolves({ mtimeMs: pastTime }); // Flag not ready
            fsStub.stat.onCall(1).resolves({ mtimeMs: futureTime }); // Cache file exists
            lockfileStub.lock.resolves(releaseLockStub);

            await setCachedSelectivityFile(cacheType, key, content);

            assert.calledOnce(fsStub.ensureDir);
            assert.calledOnce(lockfileStub.lock);
            assert.notCalled(fsStub.writeFile);
            assert.calledOnce(releaseLockStub);
        });

        it("should throw error if cache write fails", async () => {
            const key = "test-key";
            const cacheType = CacheType.TestFile;
            const content = "test content";
            const pastTime = 0;
            const releaseLockStub = sandbox.stub().resolves();
            const writeError = new Error("Write failed");

            fsStub.stat.resolves({ mtimeMs: pastTime });
            lockfileStub.lock.resolves(releaseLockStub);
            fsStub.writeFile.onFirstCall().rejects(writeError);

            const setCachePromise = setCachedSelectivityFile(cacheType, key, content);

            await assert.isRejected(setCachePromise, "Couldn't write cache to \"/tmp/");
            assert.calledOnce(releaseLockStub);
        });

        it("should log debug message if flag write fails", async () => {
            const key = "test-key";
            const cacheType = CacheType.Asset;
            const content = "test content";
            const pastTime = 0;
            const releaseLockStub = sandbox.stub().resolves();
            const flagWriteError = new Error("Flag write failed");

            fsStub.stat.resolves({ mtimeMs: pastTime });
            lockfileStub.lock.resolves(releaseLockStub);
            fsStub.writeFile.onFirstCall().resolves().onSecondCall().rejects(flagWriteError);

            const setCachePromise = setCachedSelectivityFile(cacheType, key, content);

            await assert.isRejected(setCachePromise, "Couldn't mark cache as fresh at \"/tmp/");
            assert.calledOnce(releaseLockStub);
        });

        it("should release lock even if write operations fail", async () => {
            const key = "test-key";
            const cacheType = CacheType.TestFile;
            const content = "test content";
            const pastTime = 0;
            const releaseLockStub = sandbox.stub().resolves();

            fsStub.stat.resolves({ mtimeMs: pastTime });
            lockfileStub.lock.resolves(releaseLockStub);
            fsStub.writeFile.rejects(new Error("Write failed"));

            const setCachePromise = setCachedSelectivityFile(cacheType, key, content);

            await assert.isRejected(setCachePromise);

            assert.calledOnce(releaseLockStub);
        });

        it("should ensure directory is created before writing", async () => {
            const key = "test-key";
            const cacheType = CacheType.TestFile;
            const content = "test content";
            const pastTime = 0;
            const releaseLockStub = sandbox.stub().resolves();

            fsStub.stat.resolves({ mtimeMs: pastTime });
            lockfileStub.lock.resolves(releaseLockStub);

            await setCachedSelectivityFile(cacheType, key, content);

            assert.callOrder(fsStub.ensureDir, lockfileStub.lock, fsStub.writeFile);
        });
    });
});
