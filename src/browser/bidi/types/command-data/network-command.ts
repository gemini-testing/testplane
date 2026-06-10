import { JsUInt } from "../generic";
import { BiDiBrowserUserContext } from "../modules/browser";
import { BiDiBrowsingContextBrowsingContext } from "../modules/browsing-context";
import {
    BiDiNetworkAuthCredentials,
    BiDiNetworkBytesValue,
    BiDiNetworkCollector,
    BiDiNetworkCollectorType,
    BiDiNetworkCookieHeader,
    BiDiNetworkDataType,
    BiDiNetworkHeader,
    BiDiNetworkIntercept,
    BiDiNetworkRequest,
    BiDiNetworkSetCookieHeader,
    BiDiNetworkUrlPattern,
} from "../modules/network";

// network.AddDataCollector
export type BiDiNetworkAddDataCollectorCommand = {
    method: "network.addDataCollector";
    params: BiDiNetworkAddDataCollectorParameters;
};

// network.AddDataCollectorParameters
export type BiDiNetworkAddDataCollectorParameters = {
    dataTypes: BiDiNetworkDataType[];
    maxEncodedDataSize: JsUInt;
    collectorType?: BiDiNetworkCollectorType;
    contexts?: BiDiBrowsingContextBrowsingContext[];
    userContexts?: BiDiBrowserUserContext[];
};

// network.AddIntercept
export type BiDiNetworkAddInterceptCommand = {
    method: "network.addIntercept";
    params: BiDiNetworkAddInterceptParameters;
};

// network.AddInterceptParameters
export type BiDiNetworkAddInterceptParameters = {
    phases: BiDiNetworkInterceptPhase[];
    contexts?: BiDiBrowsingContextBrowsingContext[];
    urlPatterns?: BiDiNetworkUrlPattern[];
};

// network.InterceptPhase
export type BiDiNetworkInterceptPhase = "beforeRequestSent" | "responseStarted" | "authRequired";

// network.ContinueRequest
export type BiDiNetworkContinueRequestCommand = {
    method: "network.continueRequest";
    params: BiDiNetworkContinueRequestParameters;
};

// network.ContinueRequestParameters
export type BiDiNetworkContinueRequestParameters = {
    request: BiDiNetworkRequest;
    body?: BiDiNetworkBytesValue;
    cookies?: BiDiNetworkCookieHeader[];
    headers?: BiDiNetworkHeader[];
    method?: string;
    url?: string;
};

// network.ContinueResponse
export type BiDiNetworkContinueResponseCommand = {
    method: "network.continueResponse";
    params: BiDiNetworkContinueResponseParameters;
};

// network.ContinueResponseParameters
export type BiDiNetworkContinueResponseParameters = {
    request: BiDiNetworkRequest;
    cookies?: BiDiNetworkSetCookieHeader[];
    credentials?: BiDiNetworkAuthCredentials;
    headers?: BiDiNetworkHeader[];
    reasonPhrase?: string;
    statusCode?: JsUInt;
};

// network.ContinueWithAuth
export type BiDiNetworkContinueWithAuthCommand = {
    method: "network.continueWithAuth";
    params: BiDiNetworkContinueWithAuthParameters;
};

// network.ContinueWithAuthParameters
export type BiDiNetworkContinueWithAuthParameters = {
    request: BiDiNetworkRequest;
} & (BiDiNetworkContinueWithAuthCredentials | BiDiNetworkContinueWithAuthNoCredentials);

// network.ContinueWithAuthCredentials
export type BiDiNetworkContinueWithAuthCredentials = {
    action: "provideCredentials";
    credentials: BiDiNetworkAuthCredentials;
};

// network.ContinueWithAuthNoCredentials
export type BiDiNetworkContinueWithAuthNoCredentials = {
    action: "default" | "cancel";
};

// network.DisownData
export type BiDiNetworkDisownDataCommand = {
    method: "network.disownData";
    params: BiDiNetworkDisownDataParameters;
};

// network.DisownDataParameters
export type BiDiNetworkDisownDataParameters = {
    dataType: BiDiNetworkDataType;
    collector: BiDiNetworkCollector;
    request: BiDiNetworkRequest;
};

// network.FailRequest
export type BiDiNetworkFailRequestCommand = {
    method: "network.failRequest";
    params: BiDiNetworkFailRequestParameters;
};

// network.FailRequestParameters
export type BiDiNetworkFailRequestParameters = {
    request: BiDiNetworkRequest;
};

// network.GetData
export type BiDiNetworkGetDataCommand = {
    method: "network.getData";
    params: BiDiNetworkGetDataParameters;
};

// network.GetDataParameters
export type BiDiNetworkGetDataParameters = {
    dataType: BiDiNetworkDataType;
    collector?: BiDiNetworkCollector;
    disown?: boolean;
    request: BiDiNetworkRequest;
};

// network.ProvideResponse
export type BiDiNetworkProvideResponseCommand = {
    method: "network.provideResponse";
    params: BiDiNetworkProvideResponseParameters;
};

// network.ProvideResponseParameters
export type BiDiNetworkProvideResponseParameters = {
    request: BiDiNetworkRequest;
    body?: BiDiNetworkBytesValue;
    cookies?: BiDiNetworkSetCookieHeader[];
    headers?: BiDiNetworkHeader[];
    reasonPhrase?: string;
    statusCode?: JsUInt;
};

// network.RemoveDataCollector
export type BiDiNetworkRemoveDataCollectorCommand = {
    method: "network.removeDataCollector";
    params: BiDiNetworkRemoveDataCollectorParameters;
};

// network.RemoveDataCollectorParameters
export type BiDiNetworkRemoveDataCollectorParameters = {
    collector: BiDiNetworkCollector;
};

// network.RemoveIntercept
export type BiDiNetworkRemoveInterceptCommand = {
    method: "network.removeIntercept";
    params: BiDiNetworkRemoveInterceptParameters;
};

// network.RemoveInterceptParameters
export type BiDiNetworkRemoveInterceptParameters = {
    intercept: BiDiNetworkIntercept;
};

// network.SetCacheBehavior
export type BiDiNetworkSetCacheBehaviorCommand = {
    method: "network.setCacheBehavior";
    params: BiDiNetworkSetCacheBehaviorParameters;
};

// network.SetCacheBehaviorParameters
export type BiDiNetworkSetCacheBehaviorParameters = {
    cacheBehavior: "default" | "bypass";
    contexts?: BiDiBrowsingContextBrowsingContext[];
};

// network.SetExtraHeaders
export type BiDiNetworkSetExtraHeadersCommand = {
    method: "network.setExtraHeaders";
    params: BiDiNetworkSetExtraHeadersParameters;
};

// network.SetExtraHeadersParameters
export type BiDiNetworkSetExtraHeadersParameters = {
    headers: BiDiNetworkHeader[];
    contexts?: BiDiBrowsingContextBrowsingContext[];
    userContexts?: BiDiBrowserUserContext[];
};

// NetworkCommand
export type BiDiNetworkCommand =
    | BiDiNetworkAddDataCollectorCommand
    | BiDiNetworkAddInterceptCommand
    | BiDiNetworkContinueRequestCommand
    | BiDiNetworkContinueResponseCommand
    | BiDiNetworkContinueWithAuthCommand
    | BiDiNetworkDisownDataCommand
    | BiDiNetworkFailRequestCommand
    | BiDiNetworkGetDataCommand
    | BiDiNetworkProvideResponseCommand
    | BiDiNetworkRemoveDataCollectorCommand
    | BiDiNetworkRemoveInterceptCommand
    | BiDiNetworkSetCacheBehaviorCommand
    | BiDiNetworkSetExtraHeadersCommand;
