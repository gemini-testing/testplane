import { JsUInt } from "../generic";
import { BiDiBrowsingContextBrowsingContext } from "./browsing-context";
import { BiDiBrowserUserContext } from "./browser";

// session.CapabilitiesRequest
export type BiDiSessionCapabilitiesRequest = {
    alwaysMatch?: BiDiSessionCapabilityRequest;
    firstMatch?: BiDiSessionCapabilityRequest[];
};

// session.CapabilityRequest
export type BiDiSessionCapabilityRequest = {
    acceptInsecureCerts?: boolean;
    browserName?: string;
    browserVersion?: string;
    platformName?: string;
    proxy?: BiDiSessionProxyConfiguration;
    unhandledPromptBehavior?: BiDiSessionUserPromptHandler;
};

// session.ProxyConfiguration
export type BiDiSessionProxyConfiguration =
    | BiDiSessionAutodetectProxyConfiguration
    | BiDiSessionDirectProxyConfiguration
    | BiDiSessionManualProxyConfiguration
    | BiDiSessionPacProxyConfiguration
    | BiDiSessionSystemProxyConfiguration;

// session.AutodetectProxyConfiguration
export type BiDiSessionAutodetectProxyConfiguration = {
    proxyType: "autodetect";
};

// session.DirectProxyConfiguration
export type BiDiSessionDirectProxyConfiguration = {
    proxyType: "direct";
};

// session.ManualProxyConfiguration
export type BiDiSessionManualProxyConfiguration = {
    proxyType: "manual";
    httpProxy?: string;
    sslProxy?: string;
    socksProxy?: string;
    socksVersion?: JsUInt;
    noProxy?: string[];
};

// session.SocksProxyConfiguration
export type BiDiSessionSocksProxyConfiguration = {
    socksProxy: string;
    socksVersion: JsUInt;
};

// session.PacProxyConfiguration
export type BiDiSessionPacProxyConfiguration = {
    proxyType: "pac";
    proxyAutoconfigUrl: string;
};

// session.SystemProxyConfiguration
export type BiDiSessionSystemProxyConfiguration = {
    proxyType: "system";
};

// session.UserPromptHandler
export type BiDiSessionUserPromptHandler = {
    alert?: BiDiSessionUserPromptHandlerType;
    beforeUnload?: BiDiSessionUserPromptHandlerType;
    confirm?: BiDiSessionUserPromptHandlerType;
    default?: BiDiSessionUserPromptHandlerType;
    file?: BiDiSessionUserPromptHandlerType;
    prompt?: BiDiSessionUserPromptHandlerType;
};

// session.UserPromptHandlerType
export type BiDiSessionUserPromptHandlerType = "accept" | "dismiss" | "ignore";

// session.Subscription
export type BiDiSessionSubscription = string;

// session.SubscribeParameters
export type BiDiSessionSubscribeParameters = {
    events: string[];
    contexts?: BiDiBrowsingContextBrowsingContext[];
    userContexts?: BiDiBrowserUserContext[];
};

// session.UnsubscribeByIDRequest
export type BiDiSessionUnsubscribeByIDRequest = {
    subscriptions: BiDiSessionSubscription[];
};

// session.UnsubscribeByAttributesRequest
export type BiDiSessionUnsubscribeByAttributesRequest = {
    events: string[];
};
