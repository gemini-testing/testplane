import type { RawData } from "ws";
import { inspect } from "node:util";
import { debugBidi } from "./debug";
import {
    BIDIConnectionBreakError,
    BIDIConnectionEstablishmentError,
    BIDIConnectionTerminatedError,
    BIDIConnectionTimeoutError,
    BIDIRequestError,
    BIDIRequestTimeoutError,
} from "./error";
import {
    BIDI_CONNECTION_RETRIES,
    BIDI_CONNECTION_RETRY_BASE_DELAY,
    BIDI_CONNECTION_TIMEOUT,
    BIDI_REQUEST_RETRIES,
    BIDI_REQUEST_RETRY_BASE_DELAY,
} from "./constants";
import type { BiDiMessage, BiDiEvent, BiDiCommand } from "./types";
import type { Browser } from "../types";
import { WsConnection } from "../../ws-connection";
import { WsError } from "../../ws-connection/error";
import { exponentiallyWait } from "../../ws-connection/utils";

type OnEventMessageFn = (bidiEventMessage: BiDiEvent) => unknown;

interface BiDiConnectionOptions {
    sessionId: string;
    headers?: Record<string, string>;
    requestTimeout: number;
}

export class BIDIConnection {
    public onEventMessage: OnEventMessageFn | null = null;
    private readonly _sessionId: string;

    private readonly _wsConnection: WsConnection<Record<string, unknown>, string>;

    private constructor(bidiWsEndpoint: string, { headers, sessionId, requestTimeout }: BiDiConnectionOptions) {
        this._sessionId = sessionId;

        this._wsConnection = new WsConnection<Record<string, unknown>, string>(bidiWsEndpoint, {
            headers,
            debugFn: debugBidi,
            retries: {
                count: BIDI_CONNECTION_RETRIES,
                baseDelay: BIDI_CONNECTION_RETRY_BASE_DELAY,
            },
            timeouts: {
                request: requestTimeout,
                createSession: BIDI_CONNECTION_TIMEOUT,
            },
            errors: {
                ConnectionEstablishment: BIDIConnectionEstablishmentError,
                ConnectionBreak: BIDIConnectionBreakError,
                ConnectionTerminated: BIDIConnectionTerminatedError,
                ConnectionTimeout: BIDIConnectionTimeoutError,
                RequestTimeout: BIDIRequestError,
            },
            onMessage: this._onMessage.bind(this),
        });
    }

    /** @description Creates BIDIConnection without establishing it */
    static create(browser: Browser): BIDIConnection | null {
        const sessionId = browser.publicAPI.sessionId;

        const bidiWsEndpoint = browser.publicAPI.capabilities.webSocketUrl as unknown as string;
        const headers = browser.publicAPI.options?.headers ?? {};

        if (!bidiWsEndpoint) {
            return null;
        }

        return new this(bidiWsEndpoint, { headers, sessionId, requestTimeout: browser.config.httpTimeout });
    }

    close(): void {
        this._wsConnection.close();
    }

    private _onMessage(data: RawData): void {
        const message = data.toString("utf8");

        try {
            const jsonParsedMessage: BiDiMessage = JSON.parse(message);

            if (debugBidi.enabled) {
                debugBidi(
                    `< ${inspect(
                        { sessionId: this._sessionId, ...jsonParsedMessage },
                        {
                            depth: 3,
                            maxStringLength: 150,
                            breakLength: Infinity,
                            compact: true,
                        },
                    )}`,
                );
            }

            if (!("id" in jsonParsedMessage)) {
                if (this.onEventMessage) {
                    this.onEventMessage(jsonParsedMessage);
                }

                return;
            }

            if (jsonParsedMessage.type === "error" && jsonParsedMessage.id === null) {
                debugBidi(
                    `\u2718 Received error message without ID: ${jsonParsedMessage.message}\n${jsonParsedMessage.stacktrace}`,
                );
                return;
            }

            if (jsonParsedMessage.type === "success") {
                this._wsConnection.provideResponseFor(jsonParsedMessage.id, jsonParsedMessage.result);
            } else if (jsonParsedMessage.type === "error") {
                this._wsConnection.provideResponseFor(
                    jsonParsedMessage.id as number,
                    new BIDIRequestError({
                        message: jsonParsedMessage.message,
                        code: jsonParsedMessage.error,
                        requestId: jsonParsedMessage.id as number,
                    }),
                );
            }
        } catch (err) {
            if (debugBidi.enabled) {
                const data = [
                    `\u2718 Couldn't process BIDI message`,
                    `\tSession ID: ${this._sessionId}`,
                    `\tError: ${inspect(
                        { sessionId: this._sessionId, ...(err || {}) },
                        {
                            depth: 3,
                            maxStringLength: 150,
                            breakLength: Infinity,
                            compact: true,
                        },
                    )}`,
                    `\tMessage: "${message}"`,
                ];
                debugBidi(data.join("\n"));
            }
        }
    }

    /** @description Performs high-level CDP request with retries and timeouts */
    async request<T = void>(method: BiDiCommand["method"], params: BiDiCommand["params"] = {}): Promise<T> {
        let result!: T | WsError;

        for (let retriesLeft = BIDI_REQUEST_RETRIES; retriesLeft >= 0; retriesLeft--) {
            const id = this._wsConnection.getRequestId();
            const requestMessage = JSON.stringify({ id, method, params });

            if (debugBidi.enabled) {
                debugBidi(
                    `> ${inspect(
                        {
                            sessionId: this._sessionId,
                            id,
                            method,
                            params,
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

            result = (await this._wsConnection.makeRequest(id, requestMessage)) as T | WsError;

            if (!(result instanceof WsError) || !result.isRetryable() || retriesLeft <= 0) {
                break;
            }

            if (debugBidi.enabled) {
                debugBidi(
                    `⟳ ${inspect({
                        sessionId: this._sessionId,
                        id,
                        method,
                        params,
                        errorMessage: result.message,
                        retriesLeft: retriesLeft,
                    })}`,
                );
            }

            // Intentionally avoiding wait after timeout
            if (!(result instanceof BIDIRequestTimeoutError)) {
                await exponentiallyWait({
                    baseDelay: BIDI_REQUEST_RETRY_BASE_DELAY,
                    attempt: BIDI_REQUEST_RETRIES - retriesLeft,
                });
            }
        }

        if (result instanceof WsError) {
            throw result;
        }

        return result;
    }
}
