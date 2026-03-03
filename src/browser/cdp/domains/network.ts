import { CDPEventEmitter } from "../emitter";

export interface NetworkEvents {
    dataReceived: Record<string, unknown>;
    eventSourceMessageReceived: Record<string, unknown>;
    loadingFailed: Record<string, unknown>;
    loadingFinished: Record<string, unknown>;
    requestServedFromCache: Record<string, unknown>;
    requestWillBeSent: Record<string, unknown>;
    responseReceived: Record<string, unknown>;
    webSocketClosed: Record<string, unknown>;
    webSocketCreated: Record<string, unknown>;
    webSocketFrameError: Record<string, unknown>;
    webSocketFrameReceived: Record<string, unknown>;
    webSocketFrameSent: Record<string, unknown>;
    webSocketHandshakeResponseReceived: Record<string, unknown>;
    webSocketWillSendHandshakeRequest: Record<string, unknown>;
    webTransportClosed: Record<string, unknown>;
    webTransportConnectionEstablished: Record<string, unknown>;
    webTransportCreated: Record<string, unknown>;
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/ */
export class CDPNetwork extends CDPEventEmitter<NetworkEvents> {
    public constructor() {
        super();
    }
}
