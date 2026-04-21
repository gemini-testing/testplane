import { constructWsDriverRequest } from "src/browser/wsdriver/request";
import { WsDriverCompression } from "src/browser/wsdriver/types";
import { WSD_COMPRESSION_THRESHOLD_BYTES } from "src/browser/wsdriver/constants";

describe("wsdriver/request", () => {
    it("should construct request without compression", async () => {
        const url = new URL("http://localhost/session/123/element");
        const options = { method: "POST", json: { using: "css selector", value: ".test" } };
        const connectionOptions = {
            requestId: 1,
            sessionPrefix: "/session/123/",
            compressionType: WsDriverCompression.None,
        };

        const result = await constructWsDriverRequest(url, options as any, connectionOptions);

        assert.equal(result.readUInt8(0), 1); // version
        assert.equal(result.readUInt8(1), 0b00000010); // header: Request (0), None (0), isJson (1)
        assert.equal(result.readUInt32BE(2), 1); // requestId
        assert.equal(result.readUInt16BE(6), 2); // method POST

        const commandEnd = result.indexOf(0, 8);
        const command = result.toString("utf8", 8, commandEnd);
        assert.equal(command, "element");

        const body = result.subarray(commandEnd + 1).toString("utf8");
        assert.equal(body, JSON.stringify(options.json));
    });

    it("should construct request with compression if body is large enough", async () => {
        const url = new URL("http://localhost/session/123/element");
        const largeString = "a".repeat(WSD_COMPRESSION_THRESHOLD_BYTES);
        const options = { method: "POST", json: { value: largeString } };
        const connectionOptions = {
            requestId: 1,
            sessionPrefix: "/session/123/",
            compressionType: WsDriverCompression.GZIP,
        };

        const result = await constructWsDriverRequest(url, options as any, connectionOptions);

        assert.equal(result.readUInt8(0), 1); // version
        assert.equal(result.readUInt8(1), 0b00000110); // header: Request (0), GZIP (1), isJson (1)

        const commandEnd = result.indexOf(0, 8);
        const body = result.subarray(commandEnd + 1);
        assert.notEqual(body.toString("utf8"), JSON.stringify(options.json)); // Should be compressed
    });

    it("should throw if not session-related request", async () => {
        const url = new URL("http://localhost/status");
        const options = { method: "GET" };
        const connectionOptions = {
            requestId: 1,
            sessionPrefix: "/session/123/",
            compressionType: WsDriverCompression.None,
        };

        await assert.isRejected(
            constructWsDriverRequest(url, options as any, connectionOptions),
            /Not session-related request/,
        );
    });
});
