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
    WSDriverRequestDeadlineError,
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

interface RequestDeadlineContext {
    signal: AbortSignal;
    remaining: () => number;
    check: () => void;
}

interface WSDriverRequestAgentOptions {
    onRequestDeadline?: () => void;
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
    private readonly _requestTimeout: number;
    private readonly _onRequestDeadline?: () => void;
    private readonly _deadlineEnabled: boolean;
    private readonly _requestAbort = new AbortController();

    private constructor(
        wsdWsEndpoint: string,
        {
            sessionId,
            headers,
            requestTimeout,
            clientSupportedCompressionTypes,
            onRequestDeadline,
        }: WSDriverRequestAgentOptions,
    ) {
        this._requestTimeout = requestTimeout;
        this._onRequestDeadline = onRequestDeadline;
        this._deadlineEnabled =
            process.env.TESTPLANE_WSDRIVER_DEADLINE_ENABLED === "true" &&
            Number.isFinite(requestTimeout) &&
            requestTimeout > 0;
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
        onRequestDeadline,
    }: {
        sessionId: string;
        sessionCaps: WebdriverIO.Capabilities;
        headers: Record<string, string>;
        browserConfig: BrowserConfig;
        onRequestDeadline?: () => void;
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
            onRequestDeadline,
        });
    }

    close(): void {
        if (this._deadlineEnabled) {
            this._requestAbort.abort(new WSDriverRequestAgentTerminatedError());
        }
        this._wsConnection.close(this._deadlineEnabled);
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
        if (!this._deadlineEnabled) return this._request(url, options);
        const signal = this._requestAbort.signal;
        signal.throwIfAborted();
        const responseTimeout = options.timeout?.response;
        const requestTimeout =
            Number.isFinite(responseTimeout) && responseTimeout! > 0 ? responseTimeout! : this._requestTimeout;
        const deadline = performance.now() + requestTimeout;
        let onAbort!: () => void;
        const expire = (): void => {
            if (signal.aborted) return;
            // Ошибка не ETIMEDOUT: повтор всей команды в WebdriverIO обнулит общий срок.
            const error = new WSDriverRequestDeadlineError(requestTimeout);
            this._requestAbort.abort(error);
            this._wsConnection.close(true);
            this._onRequestDeadline?.();
        };
        const context: RequestDeadlineContext = {
            signal,
            remaining: () => Math.max(1, Math.ceil(deadline - performance.now())),
            check: () => {
                if (performance.now() >= deadline) expire();
                signal.throwIfAborted();
            },
        };
        const aborted = new Promise<never>((_, reject) => {
            onAbort = (): void => reject(signal.reason);
            signal.addEventListener("abort", onAbort, { once: true });
        });
        const timer = setTimeout(expire, requestTimeout).unref();
        try {
            // Отмена закрывает транспорт; проверки после await запрещают позднюю отправку.
            return await Promise.race([this._request(url, options, context), aborted]);
        } finally {
            clearTimeout(timer);
            signal.removeEventListener("abort", onAbort);
        }
    }

    private async _request(
        url: URL,
        options: RequestWsDriverOptions,
        context?: RequestDeadlineContext,
    ): Promise<RequestWsDriverResponse> {
        let requestId!: number;
        let result!: IncomingWsDriverMessage | WsError;

        for (let retriesLeft = WSD_REQUEST_RETRIES; retriesLeft >= 0; retriesLeft--) {
            context?.check();
            requestId = this._wsConnection.getRequestId();
            const compressionType = await this._getRequestCompressionType();
            context?.check();
            const requestMessage = await constructWsDriverRequest(url, options, {
                requestId,
                sessionPrefix: this._sessionPrefix,
                compressionType,
            });

            context?.check();
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

            result = (await this._wsConnection
                .makeRequest(requestId, requestMessage, context?.remaining())
                .catch((err: WsError) => err)) as IncomingWsDriverMessage | WsError;

            context?.check();
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

            context?.check();
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
                signal: context?.signal,
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
