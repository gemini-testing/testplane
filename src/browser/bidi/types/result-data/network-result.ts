import { BiDiEmptyResult } from "../generic";
import { BiDiNetworkBytesValue, BiDiNetworkCollector, BiDiNetworkIntercept } from "../modules/network";

// network.AddDataCollectorResult
export type BiDiNetworkAddDataCollectorResult = {
    collector: BiDiNetworkCollector;
};

// network.AddInterceptResult
export type BiDiNetworkAddInterceptResult = {
    intercept: BiDiNetworkIntercept;
};

// network.ContinueRequestResult
export type BiDiNetworkContinueRequestResult = BiDiEmptyResult;

// network.ContinueResponseResult
export type BiDiNetworkContinueResponseResult = BiDiEmptyResult;

// network.ContinueWithAuthResult
export type BiDiNetworkContinueWithAuthResult = BiDiEmptyResult;

// network.DisownDataResult
export type BiDiNetworkDisownDataResult = BiDiEmptyResult;

// network.FailRequestResult
export type BiDiNetworkFailRequestResult = BiDiEmptyResult;

// network.GetDataResult
export type BiDiNetworkGetDataResult = {
    bytes: BiDiNetworkBytesValue;
};

// network.ProvideResponseResult
export type BiDiNetworkProvideResponseResult = BiDiEmptyResult;

// network.RemoveDataCollectorResult
export type BiDiNetworkRemoveDataCollectorResult = BiDiEmptyResult;

// network.RemoveInterceptResult
export type BiDiNetworkRemoveInterceptResult = BiDiEmptyResult;

// network.SetCacheBehaviorResult
export type BiDiNetworkSetCacheBehaviorResult = BiDiEmptyResult;

// network.SetExtraHeadersResult
export type BiDiNetworkSetExtraHeadersResult = BiDiEmptyResult;

// NetworkResult
export type BiDiNetworkResult =
    | BiDiNetworkAddDataCollectorResult
    | BiDiNetworkAddInterceptResult
    | BiDiNetworkContinueRequestResult
    | BiDiNetworkContinueResponseResult
    | BiDiNetworkContinueWithAuthResult
    | BiDiNetworkDisownDataResult
    | BiDiNetworkFailRequestResult
    | BiDiNetworkGetDataResult
    | BiDiNetworkProvideResponseResult
    | BiDiNetworkRemoveDataCollectorResult
    | BiDiNetworkRemoveInterceptResult
    | BiDiNetworkSetCacheBehaviorResult
    | BiDiNetworkSetExtraHeadersResult;
