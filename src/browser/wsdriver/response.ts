/* eslint-disable no-bitwise */
import { inspect } from "util";
import { RawData } from "ws";
import { IncomingWsDriverMessage, WsDriverCompressionType, WsDriverMessage, WsDriverMessageType } from "./types";
import * as logger from "../../utils/logger";
import { getDecompressed } from "./compression";
import { debugWSDriver } from "./debug";

const WSDRIVER_VERSION = 1;
// version, header, requestId, responseStatus, command null-terminator
const MIN_INCOMING_MESSAGE_LENGTH_BYTES = 1 + 1 + 4 + 2 + 1;

const rawDataToBuffer = (rawData: RawData): Buffer => {
    if (rawData instanceof Buffer) {
        return rawData;
    }

    if (Array.isArray(rawData)) {
        return Buffer.concat(rawData as Uint8Array[]);
    }

    return Buffer.from(rawData as Uint8Array);
};

// https://github.com/gemini-testing/selenoid/blob/master/wsdriver/ws_req.go#L78-L85
export const parseWsDriverIncomingMessage = async (
    incomingMessage: RawData,
): Promise<null | Error | IncomingWsDriverMessage> => {
    const data = rawDataToBuffer(incomingMessage);

    if (data.length < MIN_INCOMING_MESSAGE_LENGTH_BYTES) {
        return new Error(`Invalid incoming message "${inspect(incomingMessage)}": too short`);
    }

    const messageVersion = data.readUInt8(0);

    if (messageVersion !== WSDRIVER_VERSION) {
        logger.warn(`wsdriver: Unexpected message version. Expected '${WSDRIVER_VERSION}', got '${messageVersion}'`);
        return null;
    }

    const messageHeaders = data.readUInt8(1);
    const messageType = (messageHeaders >> 4) as WsDriverMessageType;
    const compressionType = ((messageHeaders >> 2) & 0b11) as WsDriverCompressionType;
    const isJson = Boolean((messageHeaders >> 1) & 0b1);
    const isProtocolError = Boolean(messageHeaders & 0b1);

    if (messageType !== WsDriverMessage.Response) {
        logger.warn(`wsdriver: Unexpected message type. Expected '${WsDriverMessage.Response}', got '${messageType}'`);
        return null;
    }

    const requestId = data.readUInt32BE(2);
    const statusCode = data.readUInt16BE(6);
    const requestPathEnd = data.indexOf(0, 8);

    if (requestPathEnd === -1) {
        return new Error(`Invalid incoming message with id ${requestId}: absent null-terminator for requestPath`);
    }

    const requestPath = data.toString("utf8", 8, requestPathEnd);
    const rawBody = data.subarray(requestPathEnd + 1);

    let body: Error | string | Record<string, unknown>;

    try {
        const decompressedBody: Error | Buffer | null = rawBody.byteLength
            ? await getDecompressed(rawBody, compressionType).catch(err => err)
            : null;

        if (!rawBody.byteLength || !decompressedBody) {
            body = rawBody.toString("utf8");
        } else if (decompressedBody instanceof Error) {
            body = decompressedBody;
        } else if (isJson) {
            try {
                body = JSON.parse(decompressedBody.toString("utf8"));
            } catch (cause) {
                debugWSDriver("Couldn't parse incoming JSON payload: %O", cause);
                body = decompressedBody.toString("utf8");
            }
        } else {
            body = decompressedBody.toString("utf8");
        }
    } catch (err) {
        body = err as Error;
    }

    return {
        requestId,
        statusCode,
        isJson,
        isProtocolError,
        requestPath,
        body,
        rawBody,
    } as IncomingWsDriverMessage;
};
