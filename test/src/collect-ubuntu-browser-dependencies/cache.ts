import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type { Cache as CacheType, CacheData } from "../../../src/collect-ubuntu-browser-dependencies/cache";

describe("collect-ubuntu-browser-dependencies/shared-object", () => {
    const sandbox = sinon.createSandbox();

    let cache: CacheType;

    let fsStub: Record<keyof typeof import("fs-extra"), SinonStub>;

    const setCache_ = async (data: CacheData): Promise<void> => {
        fsStub.readJSON.withArgs(sinon.match("processed-browsers-linux.json")).resolves(data.processedBrowsers);
        fsStub.readJSON.withArgs(sinon.match("ubuntu-os-version.json")).resolves(data.sharedObjectsMap);

        await cache.read();
    };

    const getCache_ = async (): Promise<CacheData> => {
        await cache.write();

        const processedBrowsersCache = fsStub.outputJSON.withArgs(sinon.match("processed-browsers-linux.json")).args;
        const sharedObjectsMapPath = fsStub.outputJSON.withArgs(sinon.match("ubuntu-os-version.json")).args;

        const result: CacheData = {
            sharedObjectsMap: sharedObjectsMapPath[sharedObjectsMapPath.length - 1][1],
            processedBrowsers: processedBrowsersCache[processedBrowsersCache.length - 1][1],
        };

        return result;
    };

    beforeEach(() => {
        fsStub = {
            readJSON: sinon.stub().resolves({}),
            outputJSON: sinon.stub().resolves({}),
            existsSync: sinon.stub().returns(false),
            readdir: sinon.stub().resolves([]),
            stat: sinon.stub().resolves({ isDirectory: false }),
        } as Record<keyof typeof import("fs-extra"), SinonStub>;

        const Cache = proxyquire("../../../src/collect-ubuntu-browser-dependencies/cache", {
            "fs-extra": fsStub,
        }).Cache;

        cache = new Cache("os-version");
    });

    afterEach(() => sandbox.restore());

    it("should filter processed browsers", async () => {
        await setCache_({
            processedBrowsers: { downloadedBrowsers: { chrome: ["80"] }, sharedObjects: ["libc.so.6"] },
            sharedObjectsMap: {},
        });

        const filteredBrowsers = cache.filterProcessedBrowsers([
            { browserName: "chrome", browserVersion: "80.0.123.17" },
            { browserName: "chrome", browserVersion: "82.0.123.17" },
        ]);

        assert.deepEqual(filteredBrowsers, [{ browserName: "chrome", browserVersion: "82.0.123.17" }]);
    });

    it("should save processed browsers", async () => {
        cache.saveProcessedBrowsers([
            { browserName: "chrome", browserVersion: "80.0.123.17" },
            { browserName: "chrome", browserVersion: "82.0.123.17" },
        ]);

        const cacheData = await getCache_();

        assert.deepEqual(cacheData.processedBrowsers.downloadedBrowsers, { chrome: ["80", "82"] });
    });

    it("should save resolved shared objects", async () => {
        cache.savePackageName("libc.so.6", "libc6");

        const cacheData = await getCache_();

        assert.deepEqual(cacheData.processedBrowsers.sharedObjects, ["libc.so.6"]);
        assert.deepEqual(cacheData.sharedObjectsMap, { "libc.so.6": "libc6" });
    });

    it("should get unresolved shared objects", async () => {
        await setCache_({
            processedBrowsers: { downloadedBrowsers: { chrome: ["80"] }, sharedObjects: ["libc.so.6", "libnss3.so"] },
            sharedObjectsMap: { "libc.so.6": "libc6" },
        });

        const unresolvedSharedObjects = cache.getUnresolvedSharedObjects();

        assert.deepEqual(unresolvedSharedObjects, ["libnss3.so"]);
    });
});
