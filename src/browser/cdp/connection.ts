import type { RawData } from "ws";
import { inspect } from "node:util";
import { debugCdp } from "./debug";
import { getWsEndpoint } from "./ws-endpoint";
import { extractRequestIdFromBrokenResponse } from "./utils";
import {
    CDPConnectionBreakError,
    CDPConnectionEstablishmentError,
    CDPConnectionTerminatedError,
    CDPConnectionTimeoutError,
    CDPError,
    CDPRequestError,
    CDPRequestTimeoutError,
} from "./error";
import {
    CDP_CONNECTION_RETRIES,
    CDP_CONNECTION_RETRY_BASE_DELAY,
    CDP_CONNECTION_TIMEOUT,
    CDP_REQUEST_RETRIES,
    CDP_REQUEST_RETRY_BASE_DELAY,
    CDP_REQUEST_TIMEOUT,
} from "./constants";
import type { CDPEvent, CDPMessage, CDPRequest } from "./types";
import type { Browser } from "../types";
import { WsConnection } from "../../ws-connection";
import { WS_ERROR_CODE } from "../../ws-connection/constants";
import { WsError } from "../../ws-connection/error";
import { exponentiallyWait } from "../../ws-connection/utils";

type OnEventMessageFn = (cdpEventMessage: CDPEvent) => unknown;

export class CDPConnection {
    public onEventMessage: OnEventMessageFn | null = null;

    private readonly _wsConnection: WsConnection<Record<string, unknown>, string>;

    private constructor(cdpWsEndpoint: string, headers?: Record<string, string>) {
        this._wsConnection = new WsConnection<Record<string, unknown>, string>(cdpWsEndpoint, {
            headers,
            debugFn: debugCdp,
            retries: {
                count: CDP_CONNECTION_RETRIES,
                baseDelay: CDP_CONNECTION_RETRY_BASE_DELAY,
            },
            timeouts: {
                request: CDP_REQUEST_TIMEOUT,
                createSession: CDP_CONNECTION_TIMEOUT,
            },
            errors: {
                ConnectionEstablishment: CDPConnectionEstablishmentError,
                ConnectionBreak: CDPConnectionBreakError,
                ConnectionTerminated: CDPConnectionTerminatedError,
                ConnectionTimeout: CDPConnectionTimeoutError,
                RequestTimeout: CDPRequestError,
            },
            onMessage: this._onMessage.bind(this),
        });
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

    close(): void {
        this._wsConnection.close();
    }

    private _onMessage(data: RawData): void {
        const message = data.toString("utf8");

        try {
            const jsonParsedMessage: CDPMessage = JSON.parse(message);

            if (debugCdp.enabled) {
                debugCdp(
                    `< ${inspect(jsonParsedMessage, {
                        depth: 3,
                        maxStringLength: 150,
                        breakLength: Infinity,
                        compact: true,
                    })}`,
                );
            }

            if (!("id" in jsonParsedMessage)) {
                if (this.onEventMessage) {
                    this.onEventMessage(jsonParsedMessage);
                }

                return;
            }

            const requestId = jsonParsedMessage.id;

            if ("result" in jsonParsedMessage) {
                this._wsConnection.provideResponseFor(requestId, jsonParsedMessage.result);
            } else if ("error" in jsonParsedMessage) {
                this._wsConnection.provideResponseFor(
                    requestId,
                    new CDPRequestError({
                        message: jsonParsedMessage.error.message,
                        code: jsonParsedMessage.error.code,
                        requestId,
                    }),
                );
            } else {
                this._wsConnection.provideResponseFor(
                    requestId,
                    new CDPRequestError({
                        message: "Received malformed response without result",
                        code: WS_ERROR_CODE.MALFORMED_RESPONSE,
                        requestId,
                    }),
                );
            }
        } catch (err) {
            if (debugCdp.enabled) {
                debugCdp(`\u2718 Couldn't process CDP message\n\tError: ${err}\n\tMessage: "${message}"`);
            }

            const requestId = extractRequestIdFromBrokenResponse(message);

            if (requestId) {
                this._wsConnection.provideResponseFor(
                    requestId,
                    new CDPRequestError({
                        message: "Received malformed response: response is invalid JSON",
                        code: WS_ERROR_CODE.MALFORMED_RESPONSE,
                        requestId,
                    }),
                );
            }
        }
    }

    /** @description Performs high-level CDP request with retries and timeouts */
    async request<T = void>(
        method: CDPRequest["method"],
        { params, sessionId }: Omit<CDPRequest, "id" | "method"> = {},
    ): Promise<T> {
        let result!: T | WsError;

        for (let retriesLeft = CDP_REQUEST_RETRIES; retriesLeft >= 0; retriesLeft--) {
            const id = this._wsConnection.getRequestId();
            const requestMessage = JSON.stringify({ id, sessionId, method, params });

            if (debugCdp.enabled) {
                debugCdp(
                    `> ${inspect(requestMessage, {
                        depth: 3,
                        maxStringLength: 150,
                        breakLength: Infinity,
                        compact: true,
                    })}`,
                );
            }

            result = (await this._wsConnection.makeRequest(id, requestMessage)) as T | WsError;

            if (!(result instanceof WsError) || !result.isRetryable() || retriesLeft <= 0) {
                break;
            }

            if (debugCdp.enabled) {
                debugCdp(
                    `⟳ ${inspect({
                        id,
                        sessionId,
                        method,
                        params,
                        errorMessage: result.message,
                        retriesLeft: retriesLeft,
                    })}`,
                );
            }

            // Intentionally avoiding wait after timeout
            if (!(result instanceof CDPRequestTimeoutError)) {
                await exponentiallyWait({
                    baseDelay: CDP_REQUEST_RETRY_BASE_DELAY,
                    attempt: CDP_REQUEST_RETRIES - retriesLeft,
                });
            }
        }

        if (result instanceof WsError) {
            throw result;
        }

        return result;
    }
}
