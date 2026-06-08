import { JsInt, JsUInt } from "../generic";
import { BiDiBrowserUserContext } from "./browser";
import { BiDiBrowsingContextBrowsingContext, BiDiBrowsingContextNavigation } from "./browsing-context";
import { BiDiScriptStackTrace } from "./script";

// network.AuthChallenge
export type BiDiNetworkAuthChallenge = {
    scheme: string;
    realm: string;
};

// network.AuthCredentials
export type BiDiNetworkAuthCredentials = {
    type: "password";
    username: string;
    password: string;
};

// network.BaseParameters
export type BiDiNetworkBaseParameters = {
    context: BiDiBrowsingContextBrowsingContext | null;
    isBlocked: boolean;
    navigation: BiDiBrowsingContextNavigation | null;
    redirectCount: JsUInt;
    request: BiDiNetworkRequestData;
    timestamp: JsUInt;
    userContext?: BiDiBrowserUserContext | null;
    intercepts?: BiDiNetworkIntercept[];
};

// network.BytesValue
export type BiDiNetworkBytesValue = BiDiNetworkStringValue | BiDiNetworkBase64Value;

// network.StringValue
export type BiDiNetworkStringValue = {
    type: "string";
    value: string;
};

// network.Base64Value
export type BiDiNetworkBase64Value = {
    type: "base64";
    value: string;
};

// network.Collector
export type BiDiNetworkCollector = string;

// network.CollectorType
export type BiDiNetworkCollectorType = "blob";

// network.SameSite
export type BiDiNetworkSameSite = "strict" | "lax" | "none" | "default";

// network.Cookie
export type BiDiNetworkCookie = {
    name: string;
    value: BiDiNetworkBytesValue;
    domain: string;
    path: string;
    size: JsUInt;
    httpOnly: boolean;
    secure: boolean;
    sameSite: BiDiNetworkSameSite;
    expiry?: JsUInt;
};

// network.CookieHeader
export type BiDiNetworkCookieHeader = {
    name: string;
    value: BiDiNetworkBytesValue;
};

// network.DataType
export type BiDiNetworkDataType = "request" | "response";

// network.FetchTimingInfo
export type BiDiNetworkFetchTimingInfo = {
    timeOrigin: number;
    requestTime: number;
    redirectStart: number;
    redirectEnd: number;
    fetchStart: number;
    dnsStart: number;
    dnsEnd: number;
    connectStart: number;
    connectEnd: number;
    tlsStart: number;
    requestStart: number;
    responseStart: number;
    responseEnd: number;
};

// network.Header
export type BiDiNetworkHeader = {
    name: string;
    value: BiDiNetworkBytesValue;
};

// network.Initiator
export type BiDiNetworkInitiator = {
    columnNumber?: JsUInt;
    lineNumber?: JsUInt;
    request?: BiDiNetworkRequest;
    stackTrace?: BiDiScriptStackTrace;
    type?: "parser" | "script" | "preflight" | "other";
};

// network.Intercept
export type BiDiNetworkIntercept = string;

// network.Request
export type BiDiNetworkRequest = string;

// network.RequestData
export type BiDiNetworkRequestData = {
    request: BiDiNetworkRequest;
    url: string;
    method: string;
    headers: BiDiNetworkHeader[];
    cookies: BiDiNetworkCookie[];
    headersSize: JsUInt;
    bodySize: JsUInt | null;
    destination: string;
    initiatorType: string | null;
    timings: BiDiNetworkFetchTimingInfo;
};

// network.ResponseContent
export type BiDiNetworkResponseContent = {
    size: JsUInt;
};

// network.ResponseData
export type BiDiNetworkResponseData = {
    url: string;
    protocol: string;
    status: JsUInt;
    statusText: string;
    fromCache: boolean;
    headers: BiDiNetworkHeader[];
    mimeType: string;
    bytesReceived: JsUInt;
    headersSize: JsUInt | null;
    bodySize: JsUInt | null;
    content: BiDiNetworkResponseContent;
    authChallenges?: BiDiNetworkAuthChallenge[];
};

// network.SetCookieHeader
export type BiDiNetworkSetCookieHeader = {
    name: string;
    value: BiDiNetworkBytesValue;
    domain?: string;
    httpOnly?: boolean;
    expiry?: string;
    maxAge?: JsInt;
    path?: string;
    sameSite?: BiDiNetworkSameSite;
    secure?: boolean;
};

// network.UrlPattern
export type BiDiNetworkUrlPattern = BiDiNetworkUrlPatternPattern | BiDiNetworkUrlPatternString;

// network.UrlPatternPattern
export type BiDiNetworkUrlPatternPattern = {
    type: "pattern";
    protocol?: string;
    hostname?: string;
    port?: string;
    pathname?: string;
    search?: string;
};

// network.UrlPatternString
export type BiDiNetworkUrlPatternString = {
    type: "string";
    pattern: string;
};
