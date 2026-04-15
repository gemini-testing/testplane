import { getCompressed, getDecompressed } from "src/browser/wsdriver/compression";
import { WsDriverCompression } from "src/browser/wsdriver/types";

describe("wsdriver/compression", () => {
    const payload = Buffer.from("hello world".repeat(256));

    describe("getCompressed", () => {
        it("should return same payload for None compression", async () => {
            const result = await getCompressed(payload, WsDriverCompression.None);
            assert.strictEqual(result, payload);
        });

        it("should compress with GZIP", async () => {
            const result = await getCompressed(payload, WsDriverCompression.GZIP);
            assert.notStrictEqual(result, payload);
            assert.isTrue(result.length > 0);
            assert.isTrue(result.length < payload.length);
        });

        it("should compress with ZSTD", async () => {
            // Skip on node < 22
            if (!("zstd" in process.versions)) {
                return;
            }
            const result = await getCompressed(payload, WsDriverCompression.ZSTD);
            assert.notStrictEqual(result, payload);
            assert.isTrue(result.length > 0);
            assert.isTrue(result.length < payload.length);
        });

        it("should throw on unknown compression", async () => {
            await assert.isRejected(getCompressed(payload, 999 as any), /Unknown compression type/);
        });
    });

    describe("getDecompressed", () => {
        it("should return same payload for None compression", async () => {
            const result = await getDecompressed(payload, WsDriverCompression.None);
            assert.strictEqual(result, payload);
        });

        it("should decompress GZIP", async () => {
            const compressed = await getCompressed(payload, WsDriverCompression.GZIP);
            const result = await getDecompressed(compressed, WsDriverCompression.GZIP);
            assert.deepEqual(result, payload);
            assert.isTrue(result.length > compressed.length);
        });

        it("should decompress ZSTD", async () => {
            if (!("zstd" in process.versions)) {
                return;
            }
            const compressed = await getCompressed(payload, WsDriverCompression.ZSTD);
            const result = await getDecompressed(compressed, WsDriverCompression.ZSTD);
            assert.deepEqual(result, payload);
            assert.isTrue(result.length > compressed.length);
        });

        it("should throw on unknown compression", async () => {
            await assert.isRejected(getDecompressed(payload, 999 as any), /Unknown compression type/);
        });
    });
});
