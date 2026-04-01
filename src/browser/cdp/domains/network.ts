import { CDPEventEmitter } from "../emitter";
import { CDPConnection } from "../connection";
import type {
    CDPFrameId,
    CDPNetworkCookie,
    CDPNetworkCookieParam,
    CDPNetworkHeaders,
    CDPNetworkInitiator,
    CDPNetworkLoaderId,
    CDPNetworkMonotonicTime,
    CDPNetworkRequest,
    CDPNetworkRequestId,
    CDPNetworkResourceType,
    CDPNetworkResponse,
    CDPNetworkTimeSinceEpoch,
    CDPNetworkWebSocketFrame,
    CDPNetworkWebSocketRequest,
    CDPNetworkWebSocketResponse,
    CDPSessionId,
} from "../types";

interface DeleteCookiesRequest {
    /** Name of the cookies to remove. */
    name: string;
    /** If specified, deletes all the cookies with the given name where domain and path match provided URL. */
    url?: string;
    /** If specified, deletes only cookies with the exact domain. */
    domain?: string;
    /** If specified, deletes only cookies with the exact path. */
    path?: string;
}

interface GetCookiesRequest {
    /** The list of URLs for which applicable cookies will be fetched. If not specified, it's assumed to be set to the list of URLs of the pages in the current context. */
    urls?: string[];
}

interface GetCookiesResponse {
    /** Array of cookie objects. */
    cookies: CDPNetworkCookie[];
}

interface GetResponseBodyResponse {
    /** Response body. */
    body: string;
    /** True, if content was sent as base64. */
    base64Encoded: boolean;
}

interface GetRequestPostDataResponse {
    /** Request body string, omitting files from multipart requests. */
    postData: string;
}

interface SetCookieRequest {
    /** Cookie name. */
    name: string;
    /** Cookie value. */
    value: string;
    /** The request-URI to associate with the setting of the cookie. This value can affect the default domain, path, source port, and source scheme values of the created cookie. */
    url?: string;
    /** Cookie domain. */
    domain?: string;
    /** Cookie path. */
    path?: string;
    /** True if cookie is secure. */
    secure?: boolean;
    /** True if cookie is http-only. */
    httpOnly?: boolean;
    /** Cookie SameSite type. */
    sameSite?: "Strict" | "Lax" | "None";
    /** Cookie expiration date, session cookie if not set. */
    expires?: CDPNetworkTimeSinceEpoch;
    /** True if cookie is SameParty. */
    sameParty?: boolean;
}

interface EnableRequest {
    maxPostDataSize?: number;
}

export interface NetworkEvents {
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#event-dataReceived */
    dataReceived: {
        /** Request identifier. */
        requestId: CDPNetworkRequestId;
        /** Timestamp. */
        timestamp: CDPNetworkMonotonicTime;
        /** Data chunk length. */
        dataLength: number;
        /** Actual bytes received (might be less than dataLength for compressed encodings). */
        encodedDataLength: number;
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#event-eventSourceMessageReceived */
    eventSourceMessageReceived: {
        /** Request identifier. */
        requestId: CDPNetworkRequestId;
        /** Timestamp. */
        timestamp: CDPNetworkMonotonicTime;
        /** Message type. */
        eventName: string;
        /** Message identifier. */
        eventId: string;
        /** Message content. */
        data: string;
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#event-loadingFailed */
    loadingFailed: {
        /** Request identifier. */
        requestId: CDPNetworkRequestId;
        /** Timestamp. */
        timestamp: CDPNetworkMonotonicTime;
        /** Resource type. */
        type: CDPNetworkResourceType;
        /** Error message. */
        errorText: string;
        /** True if loading was canceled. */
        canceled?: boolean;
        /** The reason why loading was blocked, if any. */
        blockedReason?: string;
        /** The reason why loading was blocked by CORS, if any. */
        corsErrorStatus?: {
            corsError: string;
            failedParameter: string;
        };
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#event-loadingFinished */
    loadingFinished: {
        /** Request identifier. */
        requestId: CDPNetworkRequestId;
        /** Timestamp. */
        timestamp: CDPNetworkMonotonicTime;
        /** Total number of bytes received for this request. */
        encodedDataLength: number;
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#event-requestServedFromCache */
    requestServedFromCache: {
        /** Request identifier. */
        requestId: CDPNetworkRequestId;
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#event-requestWillBeSent */
    requestWillBeSent: {
        /** Request identifier. */
        requestId: CDPNetworkRequestId;
        /** Loader identifier. Empty string if the request is fetched from worker. */
        loaderId: CDPNetworkLoaderId;
        /** URL of the document this request is loaded for. */
        documentURL: string;
        /** Request data. */
        request: CDPNetworkRequest;
        /** Timestamp. */
        timestamp: CDPNetworkMonotonicTime;
        /** Timestamp. */
        wallTime: CDPNetworkTimeSinceEpoch;
        /** Request initiator. */
        initiator: CDPNetworkInitiator;
        /** Redirect response data. */
        redirectResponse?: CDPNetworkResponse;
        /** Type of this resource. */
        type?: CDPNetworkResourceType;
        /** Frame identifier. */
        frameId?: CDPFrameId;
        /** Whether the request is initiated by a user gesture. Defaults to false. */
        hasUserGesture?: boolean;
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#event-responseReceived */
    responseReceived: {
        /** Request identifier. */
        requestId: CDPNetworkRequestId;
        /** Loader identifier. Empty string if the request is fetched from worker. */
        loaderId: CDPNetworkLoaderId;
        /** Timestamp. */
        timestamp: CDPNetworkMonotonicTime;
        /** Resource type. */
        type: CDPNetworkResourceType;
        /** Response data. */
        response: CDPNetworkResponse;
        /** Frame identifier. */
        frameId?: CDPFrameId;
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#event-webSocketClosed */
    webSocketClosed: {
        /** Request identifier. */
        requestId: CDPNetworkRequestId;
        /** Timestamp. */
        timestamp: CDPNetworkMonotonicTime;
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#event-webSocketCreated */
    webSocketCreated: {
        /** Request identifier. */
        requestId: CDPNetworkRequestId;
        /** WebSocket request URL. */
        url: string;
        /** Request initiator. */
        initiator?: CDPNetworkInitiator;
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#event-webSocketFrameError */
    webSocketFrameError: {
        /** Request identifier. */
        requestId: CDPNetworkRequestId;
        /** Timestamp. */
        timestamp: CDPNetworkMonotonicTime;
        /** WebSocket error message. */
        errorMessage: string;
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#event-webSocketFrameReceived */
    webSocketFrameReceived: {
        /** Request identifier. */
        requestId: CDPNetworkRequestId;
        /** Timestamp. */
        timestamp: CDPNetworkMonotonicTime;
        /** WebSocket response data. */
        response: CDPNetworkWebSocketFrame;
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#event-webSocketFrameSent */
    webSocketFrameSent: {
        /** Request identifier. */
        requestId: CDPNetworkRequestId;
        /** Timestamp. */
        timestamp: CDPNetworkMonotonicTime;
        /** WebSocket response data. */
        response: CDPNetworkWebSocketFrame;
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#event-webSocketHandshakeResponseReceived */
    webSocketHandshakeResponseReceived: {
        /** Request identifier. */
        requestId: CDPNetworkRequestId;
        /** Timestamp. */
        timestamp: CDPNetworkMonotonicTime;
        /** WebSocket response data. */
        response: CDPNetworkWebSocketResponse;
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#event-webSocketWillSendHandshakeRequest */
    webSocketWillSendHandshakeRequest: {
        /** Request identifier. */
        requestId: CDPNetworkRequestId;
        /** Timestamp. */
        timestamp: CDPNetworkMonotonicTime;
        /** UTC Timestamp. */
        wallTime: CDPNetworkTimeSinceEpoch;
        /** WebSocket request data. */
        request: CDPNetworkWebSocketRequest;
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#event-webTransportCreated */
    webTransportCreated: {
        /** WebTransport identifier. */
        transportId: CDPNetworkRequestId;
        /** WebTransport request URL. */
        url: string;
        /** Timestamp. */
        timestamp: CDPNetworkMonotonicTime;
        /** Request initiator. */
        initiator?: CDPNetworkInitiator;
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#event-webTransportConnectionEstablished */
    webTransportConnectionEstablished: {
        /** WebTransport identifier. */
        transportId: CDPNetworkRequestId;
        /** Timestamp. */
        timestamp: CDPNetworkMonotonicTime;
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#event-webTransportClosed */
    webTransportClosed: {
        /** WebTransport identifier. */
        transportId: CDPNetworkRequestId;
        /** Timestamp. */
        timestamp: CDPNetworkMonotonicTime;
    };
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/ */
export class CDPNetwork extends CDPEventEmitter<NetworkEvents> {
    private readonly _connection: CDPConnection;

    public constructor(connection: CDPConnection) {
        super();

        this._connection = connection;
    }

    /**
     * @param sessionId result of "Target.attachToTarget"
     * @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#method-enable
     */
    async enable(sessionId: CDPSessionId, params?: EnableRequest): Promise<void> {
        return this._connection.request("Network.enable", { sessionId, params });
    }

    /**
     * @param sessionId result of "Target.attachToTarget"
     * @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#method-disable
     */
    async disable(sessionId: CDPSessionId): Promise<void> {
        return this._connection.request("Network.disable", { sessionId });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#method-clearBrowserCache */
    async clearBrowserCache(sessionId: CDPSessionId): Promise<void> {
        return this._connection.request("Network.clearBrowserCache", { sessionId });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#method-clearBrowserCookies */
    async clearBrowserCookies(sessionId: CDPSessionId): Promise<void> {
        return this._connection.request("Network.clearBrowserCookies", { sessionId });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#method-deleteCookies */
    async deleteCookies(sessionId: CDPSessionId, params: DeleteCookiesRequest): Promise<void> {
        return this._connection.request("Network.deleteCookies", { sessionId, params });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#method-getCookies */
    async getCookies(sessionId: CDPSessionId, params?: GetCookiesRequest): Promise<GetCookiesResponse> {
        return this._connection.request("Network.getCookies", { sessionId, params });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#method-getResponseBody */
    async getResponseBody(sessionId: CDPSessionId, requestId: CDPNetworkRequestId): Promise<GetResponseBodyResponse> {
        return this._connection.request("Network.getResponseBody", { sessionId, params: { requestId } });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#method-getRequestPostData */
    async getRequestPostData(
        sessionId: CDPSessionId,
        requestId: CDPNetworkRequestId,
    ): Promise<GetRequestPostDataResponse> {
        return this._connection.request("Network.getRequestPostData", { sessionId, params: { requestId } });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#method-setBypassServiceWorker */
    async setBypassServiceWorker(sessionId: CDPSessionId, bypass: boolean): Promise<void> {
        return this._connection.request("Network.setBypassServiceWorker", { sessionId, params: { bypass } });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#method-setCacheDisabled */
    async setCacheDisabled(sessionId: CDPSessionId, cacheDisabled: boolean): Promise<void> {
        return this._connection.request("Network.setCacheDisabled", { sessionId, params: { cacheDisabled } });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#method-setCookie */
    async setCookie(sessionId: CDPSessionId, params: SetCookieRequest): Promise<{ success: boolean }> {
        return this._connection.request("Network.setCookie", { sessionId, params });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#method-setCookies */
    async setCookies(sessionId: CDPSessionId, cookies: CDPNetworkCookieParam[]): Promise<void> {
        return this._connection.request("Network.setCookies", { sessionId, params: { cookies } });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#method-setExtraHTTPHeaders */
    async setExtraHTTPHeaders(sessionId: CDPSessionId, headers: CDPNetworkHeaders): Promise<void> {
        return this._connection.request("Network.setExtraHTTPHeaders", { sessionId, params: { headers } });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Network/#method-setUserAgentOverride */
    async setUserAgentOverride(
        sessionId: CDPSessionId,
        params: { userAgent: string; acceptLanguage?: string; platform?: string },
    ): Promise<void> {
        return this._connection.request("Network.setUserAgentOverride", { sessionId, params });
    }
}
