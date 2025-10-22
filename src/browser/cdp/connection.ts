import { WebSocket, type RawData } from "ws";
import { debugCdp } from "./debug";
import { getWsEndpoint } from "./ws-endpoint";
import { exponentiallyWait, extractRequestIdFromBrokenResponse } from "./utils";
import { CDPConnectionTerminatedError, CDPError, CDPTimeoutError } from "./error";
import {
    CDP_CONNECTION_RETRIES,
    CDP_CONNECTION_RETRY_BASE_DELAY,
    CDP_CONNECTION_TIMEOUT,
    CDP_MAX_REQUEST_ID,
    CDP_REQUEST_RETRIES,
    CDP_REQUEST_RETRY_BASE_DELAY,
    CDP_REQUEST_TIMEOUT,
    CDP_ERROR_CODE,
    CDP_PING_INTERVAL,
    CDP_PING_TIMEOUT,
    CDP_PING_MAX_SUBSEQUENT_FAILS,
} from "./constants";
import type { CDPEvent, CDPMessage, CDPRequest } from "./types";
import type { Browser } from "../types";

enum WsConnectionStatus {
    DISCONNECTED, // Not connected, able to connect
    CONNECTING, // Connection is being established
    CONNECTED, // Connection established
    CLOSED, // Connection is disposed and does not require reconnecting
}

type OnEventMessageFn = (cdpEventMessage: CDPEvent) => unknown;

export class CDPConnection {
    public onEventMessage: OnEventMessageFn | null = null;
    private readonly _cdpWsEndpoint: string;
    private readonly _headers?: Record<string, string>;
    private _onPong: (() => void) | null = null;
    private _pingInterval: ReturnType<typeof setInterval> | null = null;
    private _pingSubsequentFails = 0;
    private _onConnectionCloseFn: (() => void) | null = null; // Defined, if there is connection attempt at the moment
    private _wsConnectionStatus: WsConnectionStatus = WsConnectionStatus.DISCONNECTED;
    private _wsConnection: WebSocket | null = null;
    private _wsConnectionPromise: Promise<WebSocket> | null = null;
    private _requestId = 0;
    private _pendingRequests: Record<number, (response: Record<string, unknown> | CDPError) => void> = {};

    private constructor(cdpWsEndpoint: string, headers?: Record<string, string>) {
        this._cdpWsEndpoint = cdpWsEndpoint;
        this._headers = headers;
    }

    /** @description Creates CDPConnection without establishing it */
    static async create(browser: Browser): Promise<CDPConnection> {
        const sessionId = browser.publicAPI.sessionId;

        const cdpWsEndpoint = await getWsEndpoint(browser);
        const headers = browser.publicAPI.options?.headers ?? {};

        if (!cdpWsEndpoint) {
            throw new CDPError({ message: `Couldn't determine CDP endpoint for session ${sessionId}` });
        }

        return new this(cdpWsEndpoint, headers);
    }

    /** @description Tries to establish ws connection with timeout */
    private async _tryToEstablishWsConnection(endpoint: string): Promise<WebSocket | Error> {
        return new Promise<WebSocket | Error>(resolve => {
            try {
                const onConnectionCloseFn = (): void => done(new CDPConnectionTerminatedError());

                if (this._wsConnectionStatus === WsConnectionStatus.CLOSED) {
                    onConnectionCloseFn();
                } else {
                    this._onConnectionCloseFn = onConnectionCloseFn;
                }

                // eslint-disable-next-line
                const cdpConnectionInstance = this;
                const ws = new WebSocket(endpoint, { headers: this._headers });

                let isSettled = false;

                const timeoutId = setTimeout(() => {
                    ws.close();
                    done(
                        new CDPTimeoutError({
                            message: `Couldn't establish CDP connection to "${endpoint}" in ${CDP_CONNECTION_TIMEOUT}ms`,
                        }),
                    );
                }, CDP_CONNECTION_TIMEOUT).unref();

                const onOpen = (): void => {
                    done(ws);
                };

                const onError = (error: unknown): void => {
                    ws.close();
                    done(
                        new CDPError({
                            message: `Couldn't establish CDP connection to "${endpoint}": ${error}`,
                        }),
                    );
                };

                const onClose = (): void => {
                    done(
                        new CDPError({
                            message: `CDP connection to "${endpoint}" unexpectedly closed while establishing`,
                        }),
                    );
                };

                ws.on("open", onOpen);
                ws.on("error", onError);
                ws.on("close", onClose);

                // eslint-disable-next-line no-inner-declarations
                function done(result: WebSocket | Error): void {
                    if (isSettled) {
                        return;
                    }

                    cdpConnectionInstance._onConnectionCloseFn = null;
                    isSettled = true;
                    clearTimeout(timeoutId);
                    ws.off("open", onOpen);
                    ws.off("error", onError);
                    ws.off("close", onClose);
                    resolve(result);
                }
            } catch (err) {
                resolve(err as Error);
            }
        });
    }

    /**
     * @description creates ws connection with retries or returns existing one
     * @note Concurrent requests with same params produce same ws connection
     */
    private async _getWsConnection(): Promise<WebSocket> {
        const ws = this._wsConnection;

        if (this._wsConnectionStatus === WsConnectionStatus.CLOSED) {
            throw new CDPConnectionTerminatedError({ message: `Session to ${this._cdpWsEndpoint} was closed` });
        }

        if (this._wsConnectionStatus === WsConnectionStatus.CONNECTING && this._wsConnectionPromise) {
            return this._wsConnectionPromise;
        }

        if (this._wsConnectionStatus === WsConnectionStatus.CONNECTED && ws && ws.readyState === ws.OPEN) {
            return ws;
        }

        if (this._wsConnectionStatus === WsConnectionStatus.CONNECTED && ws && ws.readyState !== ws.OPEN) {
            this._closeWsConnection("CDP connection was in invalid state", WsConnectionStatus.DISCONNECTED);
        }

        this._wsConnectionStatus = WsConnectionStatus.CONNECTING;

        this._wsConnectionPromise = (async (): Promise<WebSocket> => {
            try {
                for (let retriesLeft = CDP_CONNECTION_RETRIES; retriesLeft >= 0; retriesLeft--) {
                    const result = await this._tryToEstablishWsConnection(this._cdpWsEndpoint);

                    if (this._wsConnectionStatus === WsConnectionStatus.CLOSED) {
                        if (result instanceof WebSocket) {
                            result.close();
                        }
                        throw new CDPConnectionTerminatedError();
                    }

                    if (result instanceof WebSocket) {
                        debugCdp(`Established CDP connection to ${this._cdpWsEndpoint}`);

                        this._wsConnection = result;
                        this._wsConnectionStatus = WsConnectionStatus.CONNECTED;
                        this._pingHealthCheckStart();

                        const onPing = (): void => result.pong();
                        const onMessage = (data: RawData): void => this._onMessage(data);
                        const onError = (err: Error): void => {
                            if (result === this._wsConnection) {
                                this._closeWsConnection(
                                    `An error occured in CDP connection: ${err}`,
                                    WsConnectionStatus.DISCONNECTED,
                                );
                                this._tryToReconnect();
                            }
                        };

                        result.on("ping", onPing);
                        result.on("message", onMessage);
                        result.on("error", onError);
                        result.once("close", () => {
                            result.off("ping", onPing);
                            result.off("message", onMessage);
                            result.off("error", onError);
                            if (result === this._wsConnection) {
                                this._closeWsConnection(
                                    "CDP connection was closed unexpectedly",
                                    WsConnectionStatus.DISCONNECTED,
                                );
                                this._tryToReconnect();
                            }
                        });

                        return result;
                    }

                    if (!(result instanceof CDPError) || result instanceof CDPConnectionTerminatedError) {
                        throw result;
                    }

                    debugCdp(`${result.message}; retries left: ${retriesLeft}`);

                    // Intentionally avoiding wait after timeout
                    if (result instanceof CDPError && !(result instanceof CDPTimeoutError)) {
                        await exponentiallyWait({
                            baseDelay: CDP_CONNECTION_RETRY_BASE_DELAY,
                            attempt: CDP_CONNECTION_RETRIES - retriesLeft,
                        });
                    }
                }

                throw new CDPError({
                    message: `Couldn't establish CDP connection to ${this._cdpWsEndpoint} in ${CDP_CONNECTION_RETRIES} retries`,
                });
            } catch (err) {
                if (this._wsConnectionStatus === WsConnectionStatus.CONNECTING) {
                    this._wsConnectionStatus = WsConnectionStatus.DISCONNECTED;
                    this._wsConnectionPromise = null;
                }

                throw err;
            } finally {
                if (this._wsConnectionStatus !== WsConnectionStatus.CONNECTING) {
                    this._wsConnectionPromise = null;
                }
            }
        })();

        return this._wsConnectionPromise;
    }

    /** @description Handles websocket incoming messages, resolving pending requests */
    private _onMessage(data: RawData): void {
        const message = data.toString("utf8");

        debugCdp(`< ${message}`);

        try {
            const jsonParsedMessage: CDPMessage = JSON.parse(message);

            if (!("id" in jsonParsedMessage)) {
                if (this.onEventMessage) {
                    this.onEventMessage(jsonParsedMessage);
                }

                return;
            }

            const requestId = jsonParsedMessage.id;

            if (!this._pendingRequests[requestId]) {
                debugCdp(`Received response to request ${requestId}, which is probably timed out already`);

                return;
            }

            if ("result" in jsonParsedMessage) {
                this._pendingRequests[requestId](jsonParsedMessage.result);
            } else if ("error" in jsonParsedMessage) {
                this._pendingRequests[requestId](
                    new CDPError({
                        message: jsonParsedMessage.error.message,
                        code: jsonParsedMessage.error.code,
                        requestId: requestId,
                    }),
                );
            } else {
                this._pendingRequests[requestId](
                    new CDPError({
                        message: "Received malformed response without result",
                        code: CDP_ERROR_CODE.MALFORMED_RESPONSE,
                        requestId: requestId,
                    }),
                );
            }
        } catch (err) {
            debugCdp(`Couldn't process CDP message.\n\tError: ${err}\n\tMessage: "${message}"`);

            const requestId = extractRequestIdFromBrokenResponse(message);

            if (requestId && this._pendingRequests[requestId]) {
                this._pendingRequests[requestId](
                    new CDPError({
                        message: "Received malformed response: response is invalid JSON",
                        code: CDP_ERROR_CODE.MALFORMED_RESPONSE,
                        requestId: requestId,
                    }),
                );
            }
        }
    }

    /**
     * @description Produces connection-"uniq" request ids
     * @note Theoretically, it can collide, but given "CDP_MAX_REQUEST_ID" is INT32_MAX, it wont
     */
    private _getRequestId(): number {
        const id = ++this._requestId;

        if (this._requestId >= CDP_MAX_REQUEST_ID) {
            this._requestId = 0;
        }

        return id;
    }

    /** @description establishes ws connection, sends request with timeout and waits for response */
    private async _tryToSendRequest(
        method: CDPRequest["method"],
        { params, sessionId }: Omit<CDPRequest, "id" | "method">,
    ): Promise<Record<string, unknown> | CDPError> {
        const id = this._getRequestId();
        const ws = await this._getWsConnection();
        const requestMessage = JSON.stringify({ id, sessionId, method, params });

        if (this._wsConnectionStatus === WsConnectionStatus.CLOSED) {
            throw new CDPConnectionTerminatedError({
                message: `Couldn't send "${requestMessage}" because CDP connection was manually closed`,
            });
        }

        debugCdp(`> ${requestMessage}`);

        return new Promise<Record<string, unknown> | CDPError>(resolve => {
            const pendingRequests = this._pendingRequests;

            let isSettled = false;

            const onTimeout = setTimeout(() => {
                const err = new CDPTimeoutError({
                    message: `Timed out while waiting for ${method} for ${CDP_REQUEST_TIMEOUT}ms`,
                    requestId: id,
                });

                done(err);
            }, CDP_REQUEST_TIMEOUT).unref();

            function done(response: Record<string, unknown> | CDPError): void {
                if (isSettled) {
                    return;
                }

                isSettled = true;
                delete pendingRequests[id];
                clearTimeout(onTimeout);
                resolve(response);
            }

            pendingRequests[id] = done;

            ws.send(requestMessage, error => {
                if (!error) {
                    return;
                }

                done(
                    new CDPError({
                        message: `Couldn't send CDP request "${method}": ${error.message}`,
                        code: CDP_ERROR_CODE.SEND_FAILED,
                        requestId: id,
                    }),
                );

                // Proactively closing connection as "send error" is marker that something bad with connection happened
                if (ws === this._wsConnection) {
                    this._closeWsConnection(
                        "CDP connection was considered broken as 'send' failed",
                        WsConnectionStatus.DISCONNECTED,
                    );
                    this._tryToReconnect();
                }
            });
        });
    }

    /** @description Performs high-level CDP request with retries and timeouts */
    async request<T = void>(
        method: CDPRequest["method"],
        { params, sessionId }: Omit<CDPRequest, "id" | "method"> = {},
    ): Promise<T> {
        let result!: T | Error;

        for (let retriesLeft = CDP_REQUEST_RETRIES; retriesLeft >= 0; retriesLeft--) {
            result = (await this._tryToSendRequest(method, { params, sessionId })) as T | Error;

            const noRetriesLeft = retriesLeft <= 0;
            const connectionIsClosed = this._wsConnectionStatus === WsConnectionStatus.CLOSED;

            if (!(result instanceof CDPError) || result.isNonRetryable() || noRetriesLeft || connectionIsClosed) {
                break;
            }

            debugCdp(`${result.message}; retries left: ${retriesLeft}`);

            // Intentionally avoiding wait after timeout
            if (result instanceof CDPError && !(result instanceof CDPTimeoutError)) {
                await exponentiallyWait({
                    baseDelay: CDP_REQUEST_RETRY_BASE_DELAY,
                    attempt: CDP_REQUEST_RETRIES - retriesLeft,
                });
            }
        }

        if (result instanceof Error) {
            throw result;
        }

        return result;
    }

    private _closeWsConnection(
        sessionAbortMessage: string,
        status: WsConnectionStatus.CLOSED | WsConnectionStatus.DISCONNECTED,
    ): void {
        const ws = this._wsConnection;

        if (!ws || this._wsConnectionStatus === WsConnectionStatus.CLOSED) {
            this._wsConnection = null;
            return;
        }

        debugCdp(`${sessionAbortMessage}; endpoint: "${this._cdpWsEndpoint}"`);

        if (status === WsConnectionStatus.CLOSED && this._onConnectionCloseFn) {
            this._onConnectionCloseFn();
        }

        this._wsConnection = null;
        this._wsConnectionStatus = status;
        this._abortPendingRequests(`Request was aborted because ${sessionAbortMessage}`);
        this._pingHealthCheckStop();

        ws.close();
    }

    /**
     * @description Tries to re-establish connection after network drops
     * @note Silently gives up after failed "CDP_CONNECTION_RETRIES" attempts
     */
    private _tryToReconnect(): void {
        debugCdp(`Trying to reconnect; endpoint: "${this._cdpWsEndpoint}"`);

        this._getWsConnection()
            .then(() => debugCdp(`Successfully reconnected to session; endpoint: "${this._cdpWsEndpoint}"`))
            .catch(() => debugCdp(`Couldn't reconnect to session automatically; endpoint: "${this._cdpWsEndpoint}"`));
    }

    /** @description Used to abort all pending requests when connection is closed */
    private _abortPendingRequests(message: string): void {
        const pendingRequests = this._pendingRequests;
        const pendingRequestIds = Object.keys(pendingRequests).map(Number);

        this._pendingRequests = {};

        for (const requestId of pendingRequestIds) {
            if (pendingRequests[requestId]) {
                pendingRequests[requestId](
                    new CDPConnectionTerminatedError({
                        message,
                        requestId,
                    }),
                );
            }
        }
    }

    /** @description Closes websocket connection, terminating all pending requests */
    close(): void {
        this._closeWsConnection("Connection was closed manually", WsConnectionStatus.CLOSED);
    }

    private _pingHealthCheckStop(): void {
        this._pingSubsequentFails = 0;

        if (this._pingInterval) {
            clearInterval(this._pingInterval);
        }

        if (this._wsConnection && this._onPong) {
            this._wsConnection.off("pong", this._onPong);
        }
    }

    private _isWebSocketActive(ws: WebSocket): boolean {
        return Boolean(ws.readyState !== ws.CLOSED && ws.readyState !== ws.CLOSING && ws === this._wsConnection);
    }

    private _pingHealthCheckStart(): void {
        this._pingHealthCheckStop();

        const ws = this._wsConnection;

        if (!ws || !this._isWebSocketActive(ws)) {
            return;
        }

        this._pingHealthCheckStop();

        let isWaitingForPong = false;
        let pongTimeout: ReturnType<typeof setTimeout>;

        const onPong = (this._onPong = (): void => {
            if (isWaitingForPong && this._isWebSocketActive(ws)) {
                isWaitingForPong = false;

                debugCdp("< PONG");

                clearTimeout(pongTimeout);

                this._pingSubsequentFails = 0;
            }
        });

        ws.on("pong", onPong);

        const pingInterval = (this._pingInterval = setInterval(() => {
            if (!this._isWebSocketActive(ws)) {
                clearInterval(pingInterval);
                return;
            }

            pongTimeout = setTimeout(() => {
                if (isWaitingForPong && this._isWebSocketActive(ws)) {
                    isWaitingForPong = false;

                    this._pingSubsequentFails++;

                    debugCdp(`Ping failed(${this._pingSubsequentFails} in a row) in ${CDP_PING_TIMEOUT}ms`);

                    if (this._pingSubsequentFails >= CDP_PING_MAX_SUBSEQUENT_FAILS) {
                        this._closeWsConnection(
                            `CDP connection was considered broken as ${this._pingSubsequentFails} pings failed in a row`,
                            WsConnectionStatus.DISCONNECTED,
                        );
                        this._tryToReconnect();
                    }
                }
            }, CDP_PING_TIMEOUT).unref();

            ws.ping();

            debugCdp("> PING");

            isWaitingForPong = true;
        }, CDP_PING_INTERVAL).unref());
    }
}
