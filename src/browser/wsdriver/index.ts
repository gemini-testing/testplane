import { STATUS_CODES } from "http";
import type { RawData } from "ws";
import { inspect } from "node:util";
import { debugWSDriver } from "./debug";
import {
    WSDriverRequestAgentBreakError,
    WSDriverRequestAgentEstablishmentError,
    WSDriverRequestAgentTerminatedError,
    WSDriverRequestAgentTimeoutError,
    WSDriverError,
    WSDriverRequestError,
    WSDriverRequestTimeoutError,
} from "./error";
import {
    WSD_ACCEPT_ENCODING_HEADER,
    WSD_COMPRESSION_TYPE,
    WSD_CONNECTION_RETRIES,
    WSD_CONNECTION_RETRY_BASE_DELAY,
    WSD_CONNECTION_TIMEOUT,
    WSD_REQUEST_RETRIES,
    WSD_REQUEST_RETRY_BASE_DELAY,
} from "./constants";
import {
    IncomingWsDriverMessage,
    RequestWsDriverOptions,
    RequestWsDriverResponse,
    WsDriverCompression,
    WsDriverCompressionType,
} from "./types";
import * as logger from "../../utils/logger";
import { WsConnection } from "../../ws-connection";
import { WS_ERROR_CODE } from "../../ws-connection/constants";
import { WsError } from "../../ws-connection/error";
import { parseWsDriverIncomingMessage } from "./response";
import { BrowserConfig } from "../../config/browser-config";
import { constructWsDriverRequest } from "./request";
import { exponentiallyWait } from "../../ws-connection/utils";

interface WSDriverRequestAgentOptions {
    sessionId: string;
    headers?: Record<string, string>;
    requestTimeout: number;
    clientSupportedCompressionTypes: Array<(typeof WSD_COMPRESSION_TYPE)[keyof typeof WSD_COMPRESSION_TYPE]>;
    supportedVersions: Record<number, boolean>;
}

export class WSDriverRequestAgent {
    private readonly _wsConnection: WsConnection<IncomingWsDriverMessage, RawData>;
    private _clientSupportedCompressionTypes: Array<(typeof WSD_COMPRESSION_TYPE)[keyof typeof WSD_COMPRESSION_TYPE]>;
    private _serverSupportedCompressionType?: WsDriverCompressionType;
    private _sessionId: string;
    private _sessionPrefix: string;

    private constructor(
        wsdWsEndpoint: string,
        { sessionId, headers, requestTimeout, clientSupportedCompressionTypes }: WSDriverRequestAgentOptions,
    ) {
        headers ||= {};
        headers[WSD_ACCEPT_ENCODING_HEADER] = clientSupportedCompressionTypes.join(", ");

        this._wsConnection = new WsConnection<IncomingWsDriverMessage, RawData>(wsdWsEndpoint, {
            headers,
            debugFn: debugWSDriver,
            retries: {
                count: WSD_CONNECTION_RETRIES,
                baseDelay: WSD_CONNECTION_RETRY_BASE_DELAY,
            },
            timeouts: {
                request: requestTimeout,
                createSession: WSD_CONNECTION_TIMEOUT,
            },
            errors: {
                ConnectionEstablishment: WSDriverRequestAgentEstablishmentError,
                ConnectionBreak: WSDriverRequestAgentBreakError,
                ConnectionTerminated: WSDriverRequestAgentTerminatedError,
                ConnectionTimeout: WSDriverRequestAgentTimeoutError,
                RequestTimeout: WSDriverRequestTimeoutError,
            },
            onMessage: this._onMessage.bind(this),
        });

        this._clientSupportedCompressionTypes = clientSupportedCompressionTypes;
        this._sessionId = sessionId;
        this._sessionPrefix = `/session/${sessionId}/`;
    }

    /** @description Creates WSDriverRequestAgent without establishing it */
    static create({
        sessionId,
        sessionCaps,
        headers = {},
        browserConfig,
    }: {
        sessionId: string;
        sessionCaps: WebdriverIO.Capabilities;
        headers: Record<string, string>;
        browserConfig: BrowserConfig;
    }): WSDriverRequestAgent {
        if (!sessionCaps["se:wsdriver"]) {
            throw new WSDriverError({ message: "Couldn't determine wsdriver endpoint" });
        }

        if (!sessionCaps["se:wsdriverVersion"]) {
            throw new WSDriverError({ message: "Couldn't determine wsdriver supported versions" });
        }

        const wsdriverEndpoint = sessionCaps["se:wsdriver"];
        const wsdriverSupportedVersions = sessionCaps["se:wsdriverVersion"].split(", ").map(Number).filter(Boolean);

        const requestTimeout = browserConfig.httpTimeout;
        const supportedVersions = wsdriverSupportedVersions.reduce((acc, val) => {
            acc[val] = true;
            return acc;
        }, {} as Record<number, boolean>);
        const clientSupportedCompressionTypes = ["zstd" in process.versions ? "zstd" : null, "gzip"].filter(
            Boolean,
        ) as Array<(typeof WSD_COMPRESSION_TYPE)[keyof typeof WSD_COMPRESSION_TYPE]>;

        return new this(wsdriverEndpoint, {
            sessionId,
            headers,
            requestTimeout,
            clientSupportedCompressionTypes,
            supportedVersions,
        });
    }

    close(): void {
        this._wsConnection.close();
    }

    private async _onMessage(data: RawData, isBinary: boolean): Promise<void> {
        if (!isBinary) {
            this._wsConnection.forceReconnect(
                `Unsupported data type: Expected binary, received text: ${inspect(data)}`,
            );
            return;
        }

        const incomingMessage = await parseWsDriverIncomingMessage(data).catch((err: Error) => err);

        if (!incomingMessage) {
            // Valid, but unsupported
            return;
        }

        if (incomingMessage instanceof Error) {
            // Invalid message
            this._wsConnection.forceReconnect(incomingMessage.message);
            return;
        }

        const message = incomingMessage as IncomingWsDriverMessage;

        if (debugWSDriver.enabled) {
            const header = message.rawBody.readUint8(1);

            debugWSDriver(
                `< ${inspect(
                    {
                        sessionId: this._sessionId,
                        requestId: message.requestId,
                        header: header.toString(2).padStart(8, "0"),
                        statusCode: message.statusCode,
                        body: message.body,
                    },
                    {
                        depth: 3,
                        maxStringLength: 150,
                        breakLength: Infinity,
                        compact: true,
                    },
                )}`,
            );
        }

        if (message.isProtocolError) {
            logger.error("wsdriver: Protocol error occured while parsing message:", message);
            this._wsConnection.provideResponseFor(
                message.requestId,
                new WSDriverRequestError({
                    message: "Protocol error: " + inspect(message.body),
                    requestId: message.requestId,
                    code: WS_ERROR_CODE.PROTOCOL_ERROR,
                }),
            );
            this._wsConnection.forceReconnect("Protocol error: " + inspect(message.body));
            return;
        }

        if (message.body instanceof Error) {
            logger.error("wsdriver: Malformed response:", message.body);
            this._wsConnection.provideResponseFor(
                message.requestId,
                new WSDriverRequestError({
                    message: message.body.message,
                    requestId: message.requestId,
                    code: WS_ERROR_CODE.MALFORMED_RESPONSE,
                }),
            );
        }

        this._wsConnection.provideResponseFor(message.requestId, message);
    }

    private async _getRequestCompressionType(): Promise<WsDriverCompressionType> {
        if (typeof this._serverSupportedCompressionType !== "undefined") {
            return this._serverSupportedCompressionType;
        }

        const { responseHeaders } = await this._getConnectionProperties();

        if (!responseHeaders || !responseHeaders[WSD_ACCEPT_ENCODING_HEADER]) {
            return (this._serverSupportedCompressionType = WsDriverCompression.None);
        }

        const serverAcceptEncodingHeaders = responseHeaders[WSD_ACCEPT_ENCODING_HEADER].concat(", ") as string;
        const serverAcceptEncodings = serverAcceptEncodingHeaders.split(", ");

        for (const clientSupportedEncoding of this._clientSupportedCompressionTypes) {
            if (serverAcceptEncodings.includes(clientSupportedEncoding)) {
                if (clientSupportedEncoding === "zstd") {
                    return (this._serverSupportedCompressionType = WsDriverCompression.ZSTD);
                } else if (clientSupportedEncoding === "gzip") {
                    return (this._serverSupportedCompressionType = WsDriverCompression.GZIP);
                }
            }
        }

        return (this._serverSupportedCompressionType = WsDriverCompression.None);
    }

    private _getConnectionProperties(): ReturnType<
        WsConnection<IncomingWsDriverMessage, RawData>["getConnectionProperties"]
    > {
        return this._wsConnection.getConnectionProperties();
    }

    /** @description Performs high-level WSDriver request with timeout */
    async request(url: URL, options: RequestWsDriverOptions): Promise<RequestWsDriverResponse> {
        let requestId!: number;
        let result!: IncomingWsDriverMessage | WsError;

        for (let retriesLeft = WSD_REQUEST_RETRIES; retriesLeft >= 0; retriesLeft--) {
            requestId = this._wsConnection.getRequestId();
            const requestMessage = await constructWsDriverRequest(url, options, {
                requestId,
                sessionPrefix: this._sessionPrefix,
                compressionType: await this._getRequestCompressionType(),
            });

            if (debugWSDriver.enabled) {
                const header = requestMessage.readUint8(1);
                const commandEndIdx = requestMessage.indexOf(0, 8);
                const command = requestMessage.subarray(8, commandEndIdx).toString();
                debugWSDriver(
                    `> ${inspect(
                        {
                            sessionId: this._sessionId,
                            requestId,
                            header: header.toString(2).padStart(8, "0"),
                            method: options.method,
                            command,
                            body: options.json,
                        },
                        {
                            depth: 3,
                            maxStringLength: 150,
                            breakLength: Infinity,
                            compact: true,
                        },
                    )}`,
                );
            }

            result = (await this._wsConnection.makeRequest(requestId, requestMessage).catch((err: WsError) => err)) as
                | IncomingWsDriverMessage
                | WsError;

            if (result instanceof WSDriverRequestTimeoutError) {
                const requestError = new Error(result.message);
                requestError.stack = result.stack;
                // error code should be "ETIMEDOUT" for webdriver to be able to retry
                (requestError as { code?: string }).code = "ETIMEDOUT";
                throw requestError;
            }

            if (!(result instanceof WsError) || !result.isRetryable() || retriesLeft <= 0) {
                break;
            }

            if (debugWSDriver.enabled) {
                const header = requestMessage.readUint8(1);
                const commandEndIdx = requestMessage.indexOf(0, 8);
                const command = requestMessage.subarray(8, commandEndIdx).toString();
                debugWSDriver(
                    `⟳ ${inspect({
                        sessionId: this._sessionId,
                        requestId,
                        header: header.toString(2).padStart(8, "0"),
                        method: options.method,
                        command,
                        body: options.json,
                        errorMessage: result.message,
                        retriesLeft: retriesLeft,
                    })}`,
                );
            }

            await exponentiallyWait({
                baseDelay: WSD_REQUEST_RETRY_BASE_DELAY,
                attempt: WSD_REQUEST_RETRIES - retriesLeft,
            });
        }

        if (result instanceof WsError) {
            throw result;
        }

        const response = {
            url: url.toString(),
            method: options.method!,
            requestId,
            statusCode: result.statusCode,
            statusMessage: STATUS_CODES[result.statusCode] as string,
            req: {
                id: requestId,
                method: options.method!,
                path: options.path as string,
                host: url.host,
            },
            request: {
                id: requestId,
                options,
                requestUrl: url,
            },
            ok: result.statusCode >= 200 && result.statusCode < 300,
            rawBody: result.rawBody,
            body: result.body,
        } as RequestWsDriverResponse;

        response.req.res = response;
        response.request.response = response;

        return response;
    }
}
