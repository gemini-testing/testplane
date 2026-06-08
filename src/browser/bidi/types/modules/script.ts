import { JsUInt } from "../generic";
import { BiDiBrowserUserContext } from "./browser";
import { BiDiBrowsingContextBrowsingContext } from "./browsing-context";

// script.Channel
export type BiDiScriptChannel = string;

// script.ChannelProperties
export type BiDiScriptChannelProperties = {
    channel: BiDiScriptChannel;
    serializationOptions?: BiDiScriptSerializationOptions;
    ownership?: BiDiScriptResultOwnership;
};

// script.ChannelValue
export type BiDiScriptChannelValue = {
    type: "channel";
    value: BiDiScriptChannelProperties;
};

// script.EvaluateResult
export type BiDiScriptEvaluateResult = BiDiScriptEvaluateResultSuccess | BiDiScriptEvaluateResultException;

// script.EvaluateResultSuccess
export type BiDiScriptEvaluateResultSuccess = {
    type: "success";
    result: BiDiScriptRemoteValue;
    realm: BiDiScriptRealm;
};

// script.EvaluateResultException
export type BiDiScriptEvaluateResultException = {
    type: "exception";
    exceptionDetails: BiDiScriptExceptionDetails;
    realm: BiDiScriptRealm;
};

// script.ExceptionDetails
export type BiDiScriptExceptionDetails = {
    columnNumber: JsUInt;
    exception: BiDiScriptRemoteValue;
    lineNumber: JsUInt;
    stackTrace: BiDiScriptStackTrace;
    text: string;
};

// script.Handle
export type BiDiScriptHandle = string;

// script.InternalId
export type BiDiScriptInternalId = string;

// script.LocalValue
export type BiDiScriptLocalValue =
    | BiDiScriptRemoteReference
    | BiDiScriptPrimitiveProtocolValue
    | BiDiScriptChannelValue
    | BiDiScriptArrayLocalValue
    | BiDiScriptDateLocalValue
    | BiDiScriptMapLocalValue
    | BiDiScriptObjectLocalValue
    | BiDiScriptRegExpLocalValue
    | BiDiScriptSetLocalValue;

// script.ListLocalValue
export type BiDiScriptListLocalValue = BiDiScriptLocalValue[];

// script.ArrayLocalValue
export type BiDiScriptArrayLocalValue = {
    type: "array";
    value: BiDiScriptListLocalValue;
};

// script.DateLocalValue
export type BiDiScriptDateLocalValue = {
    type: "date";
    value: string;
};

// script.MappingLocalValue
export type BiDiScriptMappingLocalValue = [BiDiScriptLocalValue | string, BiDiScriptLocalValue][];

// script.MapLocalValue
export type BiDiScriptMapLocalValue = {
    type: "map";
    value: BiDiScriptMappingLocalValue;
};

// script.ObjectLocalValue
export type BiDiScriptObjectLocalValue = {
    type: "object";
    value: BiDiScriptMappingLocalValue;
};

// script.RegExpValue
export type BiDiScriptRegExpValue = {
    pattern: string;
    flags?: string;
};

// script.RegExpLocalValue
export type BiDiScriptRegExpLocalValue = {
    type: "regexp";
    value: BiDiScriptRegExpValue;
};

// script.SetLocalValue
export type BiDiScriptSetLocalValue = {
    type: "set";
    value: BiDiScriptListLocalValue;
};

// script.PreloadScript
export type BiDiScriptPreloadScript = string;

// script.Realm
export type BiDiScriptRealm = string;

// script.PrimitiveProtocolValue
export type BiDiScriptPrimitiveProtocolValue =
    | BiDiScriptUndefinedValue
    | BiDiScriptNullValue
    | BiDiScriptStringValue
    | BiDiScriptNumberValue
    | BiDiScriptBooleanValue
    | BiDiScriptBigIntValue;

// script.UndefinedValue
export type BiDiScriptUndefinedValue = {
    type: "undefined";
};

// script.NullValue
export type BiDiScriptNullValue = {
    type: "null";
};

// script.StringValue
export type BiDiScriptStringValue = {
    type: "string";
    value: string;
};

// script.SpecialNumber
export type BiDiScriptSpecialNumber = "NaN" | "-0" | "Infinity" | "-Infinity";

// script.NumberValue
export type BiDiScriptNumberValue = {
    type: "number";
    value: number | BiDiScriptSpecialNumber;
};

// script.BooleanValue
export type BiDiScriptBooleanValue = {
    type: "boolean";
    value: boolean;
};

// script.BigIntValue
export type BiDiScriptBigIntValue = {
    type: "bigint";
    value: string;
};

// script.RealmInfo
export type BiDiScriptRealmInfo =
    | BiDiScriptWindowRealmInfo
    | BiDiScriptDedicatedWorkerRealmInfo
    | BiDiScriptSharedWorkerRealmInfo
    | BiDiScriptServiceWorkerRealmInfo
    | BiDiScriptWorkerRealmInfo
    | BiDiScriptPaintWorkletRealmInfo
    | BiDiScriptAudioWorkletRealmInfo
    | BiDiScriptWorkletRealmInfo;

// script.BaseRealmInfo
export type BiDiScriptBaseRealmInfo = {
    realm: BiDiScriptRealm;
    origin: string;
};

// script.WindowRealmInfo
export type BiDiScriptWindowRealmInfo = BiDiScriptBaseRealmInfo & {
    type: "window";
    context: BiDiBrowsingContextBrowsingContext;
    userContext?: BiDiBrowserUserContext;
    sandbox?: string;
};

// script.DedicatedWorkerRealmInfo
export type BiDiScriptDedicatedWorkerRealmInfo = BiDiScriptBaseRealmInfo & {
    type: "dedicated-worker";
    owners: [BiDiScriptRealm];
};

// script.SharedWorkerRealmInfo
export type BiDiScriptSharedWorkerRealmInfo = BiDiScriptBaseRealmInfo & {
    type: "shared-worker";
};

// script.ServiceWorkerRealmInfo
export type BiDiScriptServiceWorkerRealmInfo = BiDiScriptBaseRealmInfo & {
    type: "service-worker";
};

// script.WorkerRealmInfo
export type BiDiScriptWorkerRealmInfo = BiDiScriptBaseRealmInfo & {
    type: "worker";
};

// script.PaintWorkletRealmInfo
export type BiDiScriptPaintWorkletRealmInfo = BiDiScriptBaseRealmInfo & {
    type: "paint-worklet";
};

// script.AudioWorkletRealmInfo
export type BiDiScriptAudioWorkletRealmInfo = BiDiScriptBaseRealmInfo & {
    type: "audio-worklet";
};

// script.WorkletRealmInfo
export type BiDiScriptWorkletRealmInfo = BiDiScriptBaseRealmInfo & {
    type: "worklet";
};

// script.RealmType
export type BiDiScriptRealmType =
    | "window"
    | "dedicated-worker"
    | "shared-worker"
    | "service-worker"
    | "worker"
    | "paint-worklet"
    | "audio-worklet"
    | "worklet";

// script.RemoteReference
export type BiDiScriptRemoteReference = BiDiScriptSharedReference | BiDiScriptRemoteObjectReference;

// script.SharedReference
export type BiDiScriptSharedReference = {
    sharedId: BiDiScriptSharedId;
    handle?: BiDiScriptHandle;
};

// script.RemoteObjectReference
export type BiDiScriptRemoteObjectReference = {
    handle: BiDiScriptHandle;
    sharedId?: BiDiScriptSharedId;
};

// script.RemoteValue
export type BiDiScriptRemoteValue =
    | BiDiScriptPrimitiveProtocolValue
    | BiDiScriptSymbolRemoteValue
    | BiDiScriptArrayRemoteValue
    | BiDiScriptObjectRemoteValue
    | BiDiScriptFunctionRemoteValue
    | BiDiScriptRegExpRemoteValue
    | BiDiScriptDateRemoteValue
    | BiDiScriptMapRemoteValue
    | BiDiScriptSetRemoteValue
    | BiDiScriptWeakMapRemoteValue
    | BiDiScriptWeakSetRemoteValue
    | BiDiScriptGeneratorRemoteValue
    | BiDiScriptErrorRemoteValue
    | BiDiScriptProxyRemoteValue
    | BiDiScriptPromiseRemoteValue
    | BiDiScriptTypedArrayRemoteValue
    | BiDiScriptArrayBufferRemoteValue
    | BiDiScriptNodeListRemoteValue
    | BiDiScriptHTMLCollectionRemoteValue
    | BiDiScriptNodeRemoteValue
    | BiDiScriptWindowProxyRemoteValue;

// script.ListRemoteValue
export type BiDiScriptListRemoteValue = BiDiScriptRemoteValue[];

// script.MappingRemoteValue
export type BiDiScriptMappingRemoteValue = [BiDiScriptRemoteValue | string, BiDiScriptRemoteValue][];

// script.SymbolRemoteValue
export type BiDiScriptSymbolRemoteValue = {
    type: "symbol";
    handle?: BiDiScriptHandle;
    internalId?: BiDiScriptInternalId;
};

// script.ArrayRemoteValue
export type BiDiScriptArrayRemoteValue = {
    type: "array";
    handle?: BiDiScriptHandle;
    internalId?: BiDiScriptInternalId;
    value?: BiDiScriptListRemoteValue;
};

// script.ObjectRemoteValue
export type BiDiScriptObjectRemoteValue = {
    type: "object";
    handle?: BiDiScriptHandle;
    internalId?: BiDiScriptInternalId;
    value?: BiDiScriptMappingRemoteValue;
};

// script.FunctionRemoteValue
export type BiDiScriptFunctionRemoteValue = {
    type: "function";
    handle?: BiDiScriptHandle;
    internalId?: BiDiScriptInternalId;
};

// script.RegExpRemoteValue
export type BiDiScriptRegExpRemoteValue = BiDiScriptRegExpLocalValue & {
    handle?: BiDiScriptHandle;
    internalId?: BiDiScriptInternalId;
};

// script.DateRemoteValue
export type BiDiScriptDateRemoteValue = BiDiScriptDateLocalValue & {
    handle?: BiDiScriptHandle;
    internalId?: BiDiScriptInternalId;
};

// script.MapRemoteValue
export type BiDiScriptMapRemoteValue = {
    type: "map";
    handle?: BiDiScriptHandle;
    internalId?: BiDiScriptInternalId;
    value?: BiDiScriptMappingRemoteValue;
};

// script.SetRemoteValue
export type BiDiScriptSetRemoteValue = {
    type: "set";
    handle?: BiDiScriptHandle;
    internalId?: BiDiScriptInternalId;
    value?: BiDiScriptListRemoteValue;
};

// script.WeakMapRemoteValue
export type BiDiScriptWeakMapRemoteValue = {
    type: "weakmap";
    handle?: BiDiScriptHandle;
    internalId?: BiDiScriptInternalId;
};

// script.WeakSetRemoteValue
export type BiDiScriptWeakSetRemoteValue = {
    type: "weakset";
    handle?: BiDiScriptHandle;
    internalId?: BiDiScriptInternalId;
};

// script.GeneratorRemoteValue
export type BiDiScriptGeneratorRemoteValue = {
    type: "generator";
    handle?: BiDiScriptHandle;
    internalId?: BiDiScriptInternalId;
};

// script.ErrorRemoteValue
export type BiDiScriptErrorRemoteValue = {
    type: "error";
    handle?: BiDiScriptHandle;
    internalId?: BiDiScriptInternalId;
};

// script.ProxyRemoteValue
export type BiDiScriptProxyRemoteValue = {
    type: "proxy";
    handle?: BiDiScriptHandle;
    internalId?: BiDiScriptInternalId;
};

// script.PromiseRemoteValue
export type BiDiScriptPromiseRemoteValue = {
    type: "promise";
    handle?: BiDiScriptHandle;
    internalId?: BiDiScriptInternalId;
};

// script.TypedArrayRemoteValue
export type BiDiScriptTypedArrayRemoteValue = {
    type: "typedarray";
    handle?: BiDiScriptHandle;
    internalId?: BiDiScriptInternalId;
};

// script.ArrayBufferRemoteValue
export type BiDiScriptArrayBufferRemoteValue = {
    type: "arraybuffer";
    handle?: BiDiScriptHandle;
    internalId?: BiDiScriptInternalId;
};

// script.NodeListRemoteValue
export type BiDiScriptNodeListRemoteValue = {
    type: "nodelist";
    handle?: BiDiScriptHandle;
    internalId?: BiDiScriptInternalId;
    value?: BiDiScriptListRemoteValue;
};

// script.HTMLCollectionRemoteValue
export type BiDiScriptHTMLCollectionRemoteValue = {
    type: "htmlcollection";
    handle?: BiDiScriptHandle;
    internalId?: BiDiScriptInternalId;
    value?: BiDiScriptListRemoteValue;
};

// script.NodeRemoteValue
export type BiDiScriptNodeRemoteValue = {
    type: "node";
    sharedId?: BiDiScriptSharedId;
    handle?: BiDiScriptHandle;
    internalId?: BiDiScriptInternalId;
    value?: BiDiScriptNodeProperties;
};

// script.NodeProperties
export type BiDiScriptNodeProperties = {
    nodeType: JsUInt;
    childNodeCount: JsUInt;
    attributes?: Record<string, string>;
    children?: BiDiScriptNodeRemoteValue[];
    localName?: string;
    mode?: "open" | "closed";
    namespaceURI?: string;
    nodeValue?: string;
    shadowRoot?: BiDiScriptNodeRemoteValue | null;
};

// script.WindowProxyRemoteValue
export type BiDiScriptWindowProxyRemoteValue = {
    type: "window";
    value: BiDiScriptWindowProxyProperties;
    handle?: BiDiScriptHandle;
    internalId?: BiDiScriptInternalId;
};

// script.WindowProxyProperties
export type BiDiScriptWindowProxyProperties = {
    context: BiDiBrowsingContextBrowsingContext;
};

// script.ResultOwnership
export type BiDiScriptResultOwnership = "root" | "none";

// script.SerializationOptions
export type BiDiScriptSerializationOptions = {
    maxDomDepth?: JsUInt | null;
    maxObjectDepth?: JsUInt | null;
    includeShadowTree?: "none" | "open" | "all";
};

// script.SharedId
export type BiDiScriptSharedId = string;

// script.StackFrame
export type BiDiScriptStackFrame = {
    columnNumber: JsUInt;
    functionName: string;
    lineNumber: JsUInt;
    url: string;
};

// script.StackTrace
export type BiDiScriptStackTrace = {
    callFrames: BiDiScriptStackFrame[];
};

// script.Source
export type BiDiScriptSource = {
    realm: BiDiScriptRealm;
    context?: BiDiBrowsingContextBrowsingContext;
    userContext?: BiDiBrowserUserContext;
};

// script.RealmTarget
export type BiDiScriptRealmTarget = {
    realm: BiDiScriptRealm;
};

// script.ContextTarget
export type BiDiScriptContextTarget = {
    context: BiDiBrowsingContextBrowsingContext;
    sandbox?: string;
};

// script.Target
export type BiDiScriptTarget = BiDiScriptContextTarget | BiDiScriptRealmTarget;
