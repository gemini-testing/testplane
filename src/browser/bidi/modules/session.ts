import type { BIDIConnection } from "../connection";
import type {
    BiDiSessionEndResult,
    BiDiSessionNewParameters,
    BiDiSessionNewResult,
    BiDiSessionStatusResult,
    BiDiSessionSubscribeParameters,
    BiDiSessionSubscribeResult,
    BiDiSessionUnsubscribeParameters,
    BiDiSessionUnsubscribeResult,
} from "../types";

/** @link https://www.w3.org/TR/webdriver-bidi/#module-session */
export class BiDiSession {
    private readonly _connection: BIDIConnection;

    public constructor(connection: BIDIConnection) {
        this._connection = connection;
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-session-status
     */
    async status(): Promise<BiDiSessionStatusResult> {
        return this._connection.request("session.status");
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-session-new
     */
    async new(params: BiDiSessionNewParameters): Promise<BiDiSessionNewResult> {
        return this._connection.request("session.new", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-session-end
     */
    async end(): Promise<BiDiSessionEndResult> {
        return this._connection.request("session.end");
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-session-subscribe
     */
    async subscribe(params: BiDiSessionSubscribeParameters): Promise<BiDiSessionSubscribeResult> {
        return this._connection.request("session.subscribe", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-session-unsubscribe
     */
    async unsubscribe(params: BiDiSessionUnsubscribeParameters): Promise<BiDiSessionUnsubscribeResult> {
        return this._connection.request("session.unsubscribe", params);
    }
}
