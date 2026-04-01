import { CDPEventEmitter } from "../emitter";
import { CDPConnection } from "../connection";
import type {
    CDPFrameId,
    CDPNetworkErrorReason,
    CDPNetworkRequest,
    CDPNetworkResourceType,
    CDPSessionId,
} from "../types";

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Fetch/#type-RequestId */
type FetchRequestId = string;

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Fetch/#type-RequestStage */
type FetchRequestStage = "Request" | "Response";

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Fetch/#type-HeaderEntry */
interface HeaderEntry {
    name: string;
    value: string;
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Fetch/#type-AuthChallenge */
interface AuthChallenge {
    /** Source of the authentication challenge. */
    source?: "Server" | "Proxy";
    /** Origin that issued the authentication challenge. */
    origin: string;
    /** The authentication scheme used, such as basic or digest. */
    scheme: string;
    /** The realm of the challenge. May be empty. */
    realm: string;
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Fetch/#type-AuthChallengeResponse */
interface AuthChallengeResponse {
    /**
     * The decision on what to do in response to the authorization challenge.
     * Default means deferring to the default behavior of the net stack, which will likely either
     * the Cancel authentication or display a popup dialog box.
     */
    response: "Default" | "CancelAuth" | "ProvideCredentials";
    /** The username to provide, possibly empty. Should only be set if response is ProvideCredentials. */
    username?: string;
    /** The password to provide, possibly empty. Should only be set if response is ProvideCredentials. */
    password?: string;
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Fetch/#type-RequestPattern */
interface RequestPattern {
    /** Wildcards ('*' -> zero or more, '?' -> exactly one) are allowed. Escape character is backslash. Omitting is equivalent to "*". */
    urlPattern?: string;
    /** If set, only requests for matching resource types will be intercepted. */
    resourceType?: CDPNetworkResourceType;
    /** Stage at which to begin intercepting requests. Default is Request. */
    requestStage?: FetchRequestStage;
}

interface EnableRequest {
    /** If specified, only requests matching any of these patterns will produce fetchRequested event and will be paused until clients response. If not set, all requests will be affected. */
    patterns?: RequestPattern[];
    /** If true, authRequired events will be issued and requests will be paused expecting a call to continueWithAuth. */
    handleAuthRequests?: boolean;
}

interface FailRequestRequest {
    /** An id the client received in requestPaused event. */
    requestId: FetchRequestId;
    /** Causes the request to fail with the given reason. */
    reason: CDPNetworkErrorReason;
}

interface FulfillRequestRequest {
    /** An id the client received in requestPaused event. */
    requestId: FetchRequestId;
    /** An HTTP response code. */
    responseCode: number;
    /** Response headers. */
    responseHeaders?: HeaderEntry[];
    /** Alternative way of specifying response headers as a \0-separated series of name: value pairs. Prefer the above method unless you need to represent some non-UTF8 values that can't be transmitted over the protocol as text. (Encoded as a base64 string when passed over JSON) */
    binaryResponseHeaders?: string;
    /** A response body. If absent, original response body will be used if the request is intercepted at the response stage and empty body will be used if the request is intercepted at the request stage. (Encoded as a base64 string when passed over JSON) */
    body?: string;
    /** A textual representation of responseCode. If absent, a standard phrase matching responseCode is used. */
    responsePhrase?: string;
}

interface ContinueRequestRequest {
    /** An id the client received in requestPaused event. */
    requestId: FetchRequestId;
    /** If set, the request url will be modified in a way that's not observable by page. */
    url?: string;
    /** If set, the request method will be overridden. */
    method?: string;
    /** If set, overrides the post data in the request. (Encoded as a base64 string when passed over JSON) */
    postData?: string;
    /** If set, overrides the request headers. Note that the overrides do not extend to subsequent redirect hops, if a redirect happens. */
    headers?: HeaderEntry[];
}

interface ContinueWithAuthRequest {
    /** An id the client received in authRequired event. */
    requestId: FetchRequestId;
    /** Response to with an authChallenge. */
    authChallengeResponse: AuthChallengeResponse;
}

interface GetResponseBodyResponse {
    /** Response body. */
    body: string;
    /** True, if content was sent as base64. */
    base64Encoded: boolean;
}

interface TakeResponseBodyAsStreamResponse {
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/IO/#type-StreamHandle */
    stream: string;
}

export interface FetchEvents {
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Fetch/#event-requestPaused */
    requestPaused: {
        /** Each request the page makes will have a unique id. */
        requestId: FetchRequestId;
        /** The details of the request. */
        request: CDPNetworkRequest;
        /** The id of the frame that initiated the request. */
        frameId: CDPFrameId;
        /** How the requested resource will be used. */
        resourceType: CDPNetworkResourceType;
        /** Response error if intercepted at response stage. */
        responseErrorReason?: CDPNetworkErrorReason;
        /** Response code if intercepted at response stage. */
        responseStatusCode?: number;
        /** Response status text if intercepted at response stage. */
        responseStatusText?: string;
        /** Response headers if intercepted at the response stage. */
        responseHeaders?: HeaderEntry[];
        /** If the intercepted request had a corresponding Network.requestWillBeSent event fired for it, then this networkId will be the same as the requestId present in the requestWillBeSent event. */
        networkId?: FetchRequestId;
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Fetch/#event-authRequired */
    authRequired: {
        /** Each request the page makes will have a unique id. */
        requestId: FetchRequestId;
        /** The details of the request. */
        request: CDPNetworkRequest;
        /** The id of the frame that initiated the request. */
        frameId: CDPFrameId;
        /** How the requested resource will be used. */
        resourceType: CDPNetworkResourceType;
        /** Details of the Authorization Challenge encountered. If this is set, client should respond with continueRequest that contains AuthChallengeResponse. */
        authChallenge: AuthChallenge;
    };
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Fetch/ */
export class CDFetch extends CDPEventEmitter<FetchEvents> {
    private readonly _connection: CDPConnection;

    public constructor(connection: CDPConnection) {
        super();

        this._connection = connection;
    }

    /**
     * @param sessionId result of "Target.attachToTarget"
     * @link https://chromedevtools.github.io/devtools-protocol/1-3/Fetch/#method-enable
     */
    async enable(sessionId: CDPSessionId, params?: EnableRequest): Promise<void> {
        return this._connection.request("Fetch.enable", { sessionId, params });
    }

    /**
     * @param sessionId result of "Target.attachToTarget"
     * @link https://chromedevtools.github.io/devtools-protocol/1-3/Fetch/#method-disable
     */
    async disable(sessionId: CDPSessionId): Promise<void> {
        return this._connection.request("Fetch.disable", { sessionId });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Fetch/#method-failRequest */
    async failRequest(sessionId: CDPSessionId, params: FailRequestRequest): Promise<void> {
        return this._connection.request("Fetch.failRequest", { sessionId, params });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Fetch/#method-fulfillRequest */
    async fulfillRequest(sessionId: CDPSessionId, params: FulfillRequestRequest): Promise<void> {
        return this._connection.request("Fetch.fulfillRequest", { sessionId, params });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Fetch/#method-continueRequest */
    async continueRequest(sessionId: CDPSessionId, params: ContinueRequestRequest): Promise<void> {
        return this._connection.request("Fetch.continueRequest", { sessionId, params });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Fetch/#method-continueWithAuth */
    async continueWithAuth(sessionId: CDPSessionId, params: ContinueWithAuthRequest): Promise<void> {
        return this._connection.request("Fetch.continueWithAuth", { sessionId, params });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Fetch/#method-getResponseBody */
    async getResponseBody(sessionId: CDPSessionId, requestId: FetchRequestId): Promise<GetResponseBodyResponse> {
        return this._connection.request("Fetch.getResponseBody", { sessionId, params: { requestId } });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Fetch/#method-takeResponseBodyAsStream */
    async takeResponseBodyAsStream(
        sessionId: CDPSessionId,
        requestId: FetchRequestId,
    ): Promise<TakeResponseBodyAsStreamResponse> {
        return this._connection.request("Fetch.takeResponseBodyAsStream", { sessionId, params: { requestId } });
    }
}
