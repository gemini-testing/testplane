import { BiDiNetworkBaseParameters, BiDiNetworkInitiator, BiDiNetworkResponseData } from "../modules/network";

// network.AuthRequired
export type BiDiNetworkAuthRequiredEvent = {
    method: "network.authRequired";
    params: BiDiNetworkAuthRequiredParameters;
};

// network.AuthRequiredParameters
export type BiDiNetworkAuthRequiredParameters = BiDiNetworkBaseParameters & {
    response: BiDiNetworkResponseData;
};

// network.BeforeRequestSent
export type BiDiNetworkBeforeRequestSentEvent = {
    method: "network.beforeRequestSent";
    params: BiDiNetworkBeforeRequestSentParameters;
};

// network.BeforeRequestSentParameters
export type BiDiNetworkBeforeRequestSentParameters = BiDiNetworkBaseParameters & {
    initiator?: BiDiNetworkInitiator;
};

// network.FetchError
export type BiDiNetworkFetchErrorEvent = {
    method: "network.fetchError";
    params: BiDiNetworkFetchErrorParameters;
};

// network.FetchErrorParameters
export type BiDiNetworkFetchErrorParameters = BiDiNetworkBaseParameters & {
    errorText: string;
};

// network.ResponseCompleted
export type BiDiNetworkResponseCompletedEvent = {
    method: "network.responseCompleted";
    params: BiDiNetworkResponseCompletedParameters;
};

// network.ResponseCompletedParameters
export type BiDiNetworkResponseCompletedParameters = BiDiNetworkBaseParameters & {
    response: BiDiNetworkResponseData;
};

// network.ResponseStarted
export type BiDiNetworkResponseStartedEvent = {
    method: "network.responseStarted";
    params: BiDiNetworkResponseStartedParameters;
};

// network.ResponseStartedParameters
export type BiDiNetworkResponseStartedParameters = BiDiNetworkBaseParameters & {
    response: BiDiNetworkResponseData;
};

// NetworkEvent
export type BiDiNetworkEvent =
    | BiDiNetworkAuthRequiredEvent
    | BiDiNetworkBeforeRequestSentEvent
    | BiDiNetworkFetchErrorEvent
    | BiDiNetworkResponseCompletedEvent
    | BiDiNetworkResponseStartedEvent;
