/* eslint-disable new-cap */
import { IncomingMessage } from "node:http";
import { WebSocket, type RawData } from "ws";
import {
    WsTimeoutError,
    WsConnectionTerminatedError,
    WsError,
    WsConnectionEstablishmentError,
    WsConnectionBreakError,
    WsConnectionTimeoutError,
    WsRequestTimeoutError,
} from "./error";
import { exponentiallyWait } from "./utils";
import { WS_MAX_REQUEST_ID, WS_PING_INTERVAL, WS_PING_TIMEOUT, WS_PING_MAX_SUBSEQUENT_FAILS } from "./constants";

enum WsConnectionStatus {
    DISCONNECTED, // Not connected, able to connect
    CONNECTING, // Connection is being established
    CONNECTED, // Connection established
    CLOSED, // Connection is disposed and does not require reconnecting
}

interface WsConnectionRetries {
    count: number;
    baseDelay: number;
    factor?: number;
}

interface WsConnectionTimeouts {
    createSession: number;
    request: number;
}

interface WsConnectionErrors {
    ConnectionEstablishment: new (
        ...args: ConstructorParameters<typeof WsConnectionEstablishmentError>
    ) => WsConnectionEstablishmentError;
    ConnectionTerminated: new (
        ...args: ConstructorParameters<typeof WsConnectionTerminatedError>
    ) => WsConnectionTerminatedError;
    ConnectionBreak: new (...args: ConstructorParameters<typeof WsConnectionBreakError>) => WsConnectionBreakError;
    ConnectionTimeout: new (
        ...args: ConstructorParameters<typeof WsConnectionTimeoutError>
    ) => WsConnectionTimeoutError;
    RequestTimeout: new (...args: ConstructorParameters<typeof WsRequestTimeoutError>) => WsRequestTimeoutError;
}

interface WsConnectionOptions {
    headers?: Record<string, string>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    debugFn?: (formatter: any, ...args: any[]) => void;
    retries?: WsConnectionRetries;
    timeouts: WsConnectionTimeouts;
    errors: WsConnectionErrors;
    onMessage: (data: RawData, isBinary: boolean) => void | Promise<void>;
}

// Closing WS when its still not connected produces error:
// https://github.com/websockets/ws/blob/86eac5b44ac2bff9087ec40c9bd06bc7b4f0da07/lib/websocket.js#L297-L301
const closeWsConnection = (ws: WebSocket): void => {
    if (ws.readyState !== ws.CONNECTING) {
        ws.close();
    } else {
        ws.once("open", () => {
            ws.close();
        });
    }
};

export class WsConnection<
    ResponseMessageType = unknown,
    RequestMessageType extends string | RawData = string | RawData,
> {
    private readonly _endpoint: string;
    private readonly _requestHeaders?: Record<string, string>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly _debugFn: (formatter: any, ...args: any[]) => void;
    private readonly _retries: WsConnectionRetries;
    private readonly _timeouts: WsConnectionTimeouts;
    private readonly _errors: WsConnectionErrors;
    private readonly _onMessage: (data: RawData, isBinary: boolean) => void | Promise<void>;
    private readonly _onResponseHeaders?: (headers: IncomingMessage["headers"]) => void;
    private readonly _onReconnect?: () => void;
    private readonly _onDisconnect?: () => void;
    private readonly _onClose?: () => void;
    private _onPong: (() => void) | null = null;
    private _pingShouldSkip = false;
    private _pingInterval: ReturnType<typeof setInterval> | null = null;
    private _pingSubsequentFails = 0;
    private _onConnectionCloseFn: (() => void) | null = null; // Defined, if there is connection attempt at the moment
    private _wsConnectionStatus: WsConnectionStatus = WsConnectionStatus.DISCONNECTED;
    private _wsConnection: WebSocket | null = null;
    private _wsConnectionPromise: Promise<WebSocket> | null = null;
    private _requestId = 0;
    private _pendingRequests: Record<number, (response: ResponseMessageType | WsError) => void> = {};

    constructor(endpoint: string, options: WsConnectionOptions) {
        const { headers, debugFn, retries, timeouts, errors, onMessage } = options;

        this._endpoint = endpoint;
        this._requestHeaders = headers;
        this._debugFn = debugFn || ((): void => {});
        this._retries = retries || { count: 3, baseDelay: 500, factor: 2 };
        this._timeouts = timeouts;
        this._errors = errors;
        this._onMessage = onMessage;
    }

    async getConnectionProperties(): Promise<{ responseHeaders?: IncomingMessage["headers"] }> {
        await this._getWsConnection();

        return {
            responseHeaders: this._responseHeaders,
        };
    }

    private _responseHeaders?: IncomingMessage["headers"];

    /** @description Tries to establish ws connection with timeout */
    private async _tryToEstablishWsConnection(endpoint: string): Promise<WebSocket | Error> {
        return new Promise<WebSocket | Error>(resolve => {
            try {
                const onConnectionCloseFn = (): void => done(new this._errors.ConnectionTerminated());

                if (this._wsConnectionStatus === WsConnectionStatus.CLOSED) {
                    onConnectionCloseFn();
                } else {
                    this._onConnectionCloseFn = onConnectionCloseFn;
                }

                // eslint-disable-next-line
                const cdpConnectionInstance = this;
                const ws = new WebSocket(endpoint, { headers: this._requestHeaders });
                let isSettled = false;

                const timeoutId = setTimeout(() => {
                    closeWsConnection(ws);
                    done(
                        new this._errors.ConnectionTimeout({
                            message: `Couldn't establish WS connection to "${endpoint}" in ${this._timeouts.createSession}ms`,
                        }),
                    );
                }, this._timeouts.createSession).unref();

                const onOpen = (): void => {
                    done(ws);
                };

                const onError = (error: unknown): void => {
                    closeWsConnection(ws);
                    done(
                        new this._errors.ConnectionEstablishment({
                            message: `Couldn't establish WS connection to "${endpoint}": ${error}`,
                        }),
                    );
                };

                const onClose = (): void => {
                    done(
                        new this._errors.ConnectionEstablishment({
                            message: `WS connection to "${endpoint}" unexpectedly closed while establishing`,
                        }),
                    );
                };

                const onUpgrade = (res: IncomingMessage): void => {
                    this._responseHeaders = res.headers;
                    this._onResponseHeaders?.(res.headers);
                };

                ws.on("open", onOpen);
                ws.on("error", onError);
                ws.on("close", onClose);
                ws.on("upgrade", onUpgrade);

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
                    ws.off("upgrade", onUpgrade);
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
            throw new this._errors.ConnectionTerminated({ message: `Session to ${this._endpoint} was closed` });
        }

        if (this._wsConnectionStatus === WsConnectionStatus.CONNECTING && this._wsConnectionPromise) {
            return this._wsConnectionPromise;
        }

        if (this._wsConnectionStatus === WsConnectionStatus.CONNECTED && ws && ws.readyState === ws.OPEN) {
            return ws;
        }

        if (this._wsConnectionStatus === WsConnectionStatus.CONNECTED && ws && ws.readyState !== ws.OPEN) {
            this._closeWsConnection("WS connection was in invalid state", WsConnectionStatus.DISCONNECTED);
        }

        this._wsConnectionStatus = WsConnectionStatus.CONNECTING;

        this._wsConnectionPromise = (async (): Promise<WebSocket> => {
            try {
                for (let retriesLeft = this._retries.count || 0; retriesLeft >= 0; retriesLeft--) {
                    const result = await this._tryToEstablishWsConnection(this._endpoint);

                    if (this._wsConnectionStatus === WsConnectionStatus.CLOSED) {
                        if (result instanceof WebSocket) {
                            closeWsConnection(result);
                        }

                        throw new this._errors.ConnectionTerminated();
                    }

                    if (result instanceof WebSocket) {
                        this._debugFn(`\u2713 Established WS connection to ${this._endpoint}`);

                        this._wsConnection = result;
                        this._wsConnectionStatus = WsConnectionStatus.CONNECTED;
                        this._pingHealthCheckStart();

                        const onPing = (): void => result.pong();
                        const onMessage = (data: RawData, isBinary: boolean): void | Promise<void> =>
                            this._onMessage(data, isBinary);
                        const onError = (err: Error): void => {
                            if (result === this._wsConnection) {
                                this._closeWsConnection(
                                    `An error occured in WS connection: ${err}`,
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
                                    "WS connection was closed unexpectedly",
                                    WsConnectionStatus.DISCONNECTED,
                                );
                                this._tryToReconnect();
                            }
                        });

                        return result;
                    }

                    if (!(result instanceof WsError) || !result.isRetryable()) {
                        throw result;
                    }

                    this._debugFn(`⟳ ${result.message}; retries left: ${retriesLeft}`);

                    // Intentionally avoiding wait after timeout
                    if (result instanceof WsError && !(result instanceof WsTimeoutError)) {
                        await exponentiallyWait({
                            baseDelay: this._retries.baseDelay,
                            attempt: this._retries.count - retriesLeft,
                            factor: this._retries.factor,
                        });
                    }
                }

                throw new this._errors.ConnectionEstablishment({
                    message: `Couldn't establish WS connection to ${this._endpoint} in ${this._retries.count} retries`,
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

    /** @description Produces connection-"uniq" request ids */
    getRequestId(): number {
        const id = ++this._requestId;

        if (this._requestId >= WS_MAX_REQUEST_ID) {
            this._requestId = 0;
        }

        return id;
    }

    /** @description Performs WS request with timeout */
    async makeRequest(requestId: number, requestMessage: RequestMessageType): Promise<ResponseMessageType | WsError> {
        const ws = await this._getWsConnection();

        if (this._wsConnectionStatus === WsConnectionStatus.CLOSED) {
            throw new this._errors.ConnectionTerminated({
                requestId,
                message: `Couldn't send request because WS connection was manually closed`,
            });
        }

        return new Promise<ResponseMessageType | WsError>(resolve => {
            const pendingRequests = this._pendingRequests;
            let isSettled = false;

            const onTimeout = setTimeout(() => {
                const err = new this._errors.RequestTimeout({
                    message: `Timed out while waiting for request in ${this._timeouts.request}ms`,
                    requestId,
                });

                done(err);
            }, this._timeouts.request).unref();

            function done(response: ResponseMessageType | WsError): void {
                if (isSettled) {
                    return;
                }

                isSettled = true;
                delete pendingRequests[requestId];
                clearTimeout(onTimeout);
                resolve(response);
            }

            pendingRequests[requestId] = done;

            ws.send(requestMessage, error => {
                if (!error) {
                    this._pingShouldSkip = true;
                    return;
                }

                done(
                    new this._errors.ConnectionBreak({
                        message: `Couldn't send WS request: ${error.message}`,
                        requestId,
                    }),
                );

                // Proactively closing connection as "send error" is marker that something bad with connection happened
                if (ws === this._wsConnection) {
                    this._closeWsConnection(
                        "WS connection was considered broken as 'send' failed",
                        WsConnectionStatus.DISCONNECTED,
                    );
                    this._tryToReconnect();
                }
            });
        });
    }

    provideResponseFor(requestId: number, data: ResponseMessageType | WsError): void {
        if (!this._pendingRequests[requestId]) {
            this._debugFn(`! Received response to request ${requestId}, which is probably timed out already`);
            return;
        }

        this._pendingRequests[requestId](data);
    }

    forceReconnect(sessionAbortMessage: string): void {
        this._closeWsConnection(sessionAbortMessage, WsConnectionStatus.DISCONNECTED);
        this._tryToReconnect();
    }

    /** @description Used to abort all pending requests when connection is closed */
    private _abortPendingRequests(message: string, isTerminated: boolean): void {
        const pendingRequests = this._pendingRequests;
        const pendingRequestIds = Object.keys(pendingRequests).map(Number);

        this._pendingRequests = {};

        for (const requestId of pendingRequestIds) {
            if (pendingRequests[requestId]) {
                pendingRequests[requestId](
                    isTerminated
                        ? new this._errors.ConnectionTerminated({
                              message,
                              requestId,
                          })
                        : new this._errors.ConnectionBreak({
                              message,
                              requestId,
                          }),
                );
            }
        }
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

        this._debugFn(`\u2718 ${sessionAbortMessage}; endpoint: "${this._endpoint}"`);

        const isClosing = status === WsConnectionStatus.CLOSED;

        if (isClosing && this._onConnectionCloseFn) {
            this._onConnectionCloseFn();
        }

        this._wsConnection = null;
        this._wsConnectionStatus = status;
        this._abortPendingRequests(`Request was aborted because ${sessionAbortMessage}`, isClosing);
        this._pingHealthCheckStop();

        if (isClosing) {
            this._onClose?.();
        } else {
            this._onDisconnect?.();
        }

        closeWsConnection(ws);
    }

    /**
     * @description Tries to re-establish connection after network drops
     * @note Silently gives up after failed retries attempts
     */
    private _tryToReconnect(): void {
        this._debugFn(`⟳ Trying to reconnect; endpoint: "${this._endpoint}"`);

        this._getWsConnection()
            .then(() => {
                this._onReconnect?.();
                this._debugFn(`\u2713 Successfully reconnected to session; endpoint: "${this._endpoint}"`);
            })
            .catch(() =>
                this._debugFn(`\u2718 Couldn't reconnect to session automatically; endpoint: "${this._endpoint}"`),
            );
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

                this._debugFn("< PONG");

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

            if (this._pingShouldSkip) {
                this._pingShouldSkip = false;
                return;
            }

            pongTimeout = setTimeout(() => {
                if (isWaitingForPong && this._isWebSocketActive(ws)) {
                    isWaitingForPong = false;

                    this._pingSubsequentFails++;

                    this._debugFn(`! Ping failed(${this._pingSubsequentFails} in a row) in ${WS_PING_TIMEOUT}ms`);

                    if (this._pingSubsequentFails >= WS_PING_MAX_SUBSEQUENT_FAILS) {
                        this._closeWsConnection(
                            `WS connection was considered broken as ${this._pingSubsequentFails} pings failed in a row`,
                            WsConnectionStatus.DISCONNECTED,
                        );
                        this._tryToReconnect();
                    }
                }
            }, WS_PING_TIMEOUT).unref();

            ws.ping();

            this._debugFn("> PING");

            isWaitingForPong = true;
        }, WS_PING_INTERVAL).unref());
    }
}
