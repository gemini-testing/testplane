/* eslint-disable no-bitwise */
import {
    RequestWsDriverOptions,
    WsDriverCompression,
    WsDriverCompressionType,
    WsDriverMessage,
    WsDriverMethod,
    WsDriverMethodType,
    WsDriverRequestMethodString,
} from "./types";
import { WSD_COMPRESSION_THRESHOLD_BYTES } from "./constants";
import { getCompressed } from "./compression";

interface RequestOptions {
    method?: WsDriverRequestMethodString;
    headers?: Record<string, string | string[] | undefined>;
    json?: Record<string, unknown>;
}

interface ConnectionOptions {
    requestId: number;
    sessionPrefix: string;
    compressionType: WsDriverCompressionType;
}

const WSDRIVER_VERSION = 1;
// version, header, requestId, requestMethod, command null-terminator
const OUTGOING_MESSAGE_AUXILIARY_BYTES = 1 + 1 + 4 + 2 + 1;

const constructHeaderByte = (compressionType: WsDriverCompressionType, isJson: boolean): number => {
    let headerByte = 0;

    headerByte |= WsDriverMessage.Request << 4;
    headerByte |= compressionType << 2;
    headerByte |= +isJson << 1;

    return headerByte;
};

const getRequestMethod = (method: RequestOptions["method"]): WsDriverMethodType => {
    if (!method) {
        return WsDriverMethod.get;
    }

    const methodLowerCase = method.toLowerCase();
    const encodedMethodType = WsDriverMethod[methodLowerCase as keyof typeof WsDriverMethod];

    if (typeof encodedMethodType !== "undefined") {
        return encodedMethodType;
    }

    throw new Error(`Unsupported method: "${method}"`);
};

export const constructWsDriverRequest = async (
    url: URL,
    requestOptions: RequestWsDriverOptions,
    connectionOptions: ConnectionOptions,
): Promise<Buffer> => {
    const commandStartIdx = url.pathname.indexOf(connectionOptions.sessionPrefix);

    if (commandStartIdx === -1) {
        throw new Error("Not session-related request");
    }

    const command = url.pathname.slice(commandStartIdx + connectionOptions.sessionPrefix.length);
    const bodyPayload = requestOptions.json ? Buffer.from(JSON.stringify(requestOptions.json)) : Buffer.alloc(0);
    const shouldCompress =
        connectionOptions.compressionType !== WsDriverCompression.None &&
        Buffer.byteLength(bodyPayload) >= WSD_COMPRESSION_THRESHOLD_BYTES;
    const compressedPayload = shouldCompress
        ? await getCompressed(bodyPayload, connectionOptions.compressionType)
        : bodyPayload;
    const headerByte = constructHeaderByte(
        shouldCompress ? connectionOptions.compressionType : WsDriverCompression.None,
        true,
    );
    const requestMethod = getRequestMethod(requestOptions.method);

    const resultMessage = Buffer.alloc(
        OUTGOING_MESSAGE_AUXILIARY_BYTES + Buffer.byteLength(command) + Buffer.byteLength(compressedPayload),
    );

    let ptr = 0;

    ptr = resultMessage.writeUInt8(WSDRIVER_VERSION);
    ptr = resultMessage.writeUint8(headerByte, ptr);
    ptr = resultMessage.writeUint32BE(connectionOptions.requestId, ptr);
    ptr = resultMessage.writeUint16BE(requestMethod, ptr);
    ptr += resultMessage.write(command, ptr, "utf8");
    ptr = resultMessage.writeUint8(0, ptr);
    ptr += compressedPayload.copy(resultMessage, ptr);

    if (ptr !== resultMessage.byteLength) {
        throw new Error("WSDriver request message construction failed");
    }

    return resultMessage;
};
