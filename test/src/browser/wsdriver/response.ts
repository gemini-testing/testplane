/* eslint-disable no-bitwise */
import { parseWsDriverIncomingMessage } from "src/browser/wsdriver/response";
import { WsDriverCompression, WsDriverMessage } from "src/browser/wsdriver/types";

describe("wsdriver/response", () => {
    it("should parse valid uncompressed JSON response", async () => {
        const body = Buffer.from(JSON.stringify({ value: "test" }));
        const command = Buffer.from("element");
        const message = Buffer.alloc(8 + command.length + 1 + body.length);

        message.writeUInt8(1, 0); // version
        message.writeUInt8((WsDriverMessage.Response << 4) | (WsDriverCompression.None << 2) | 2, 1); // header: Response, None, isJson
        message.writeUInt32BE(123, 2); // requestId
        message.writeUInt16BE(200, 6); // status
        command.copy(message, 8);
        message.writeUInt8(0, 8 + command.length);
        body.copy(message, 8 + command.length + 1);

        const result = await parseWsDriverIncomingMessage(message);

        assert.deepEqual(result, {
            requestId: 123,
            statusCode: 200,
            isJson: true,
            isProtocolError: false,
            requestPath: "element",
            body: { value: "test" },
            rawBody: body,
        });
    });

    it("should return Error if message is too short", async () => {
        const message = Buffer.alloc(5);
        const result = await parseWsDriverIncomingMessage(message);
        assert.instanceOf(result, Error);
        assert.match((result as Error).message, /too short/);
    });

    it("should return null if version is unexpected", async () => {
        const message = Buffer.alloc(20);
        message.writeUInt8(2, 0); // version 2
        const result = await parseWsDriverIncomingMessage(message);
        assert.isNull(result);
    });

    it("should return null if message type is not Response", async () => {
        const message = Buffer.alloc(20);
        message.writeUInt8(1, 0); // version 1
        message.writeUInt8(WsDriverMessage.Request << 4, 1); // Request type
        const result = await parseWsDriverIncomingMessage(message);
        assert.isNull(result);
    });
});
