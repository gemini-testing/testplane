import { JsUInt } from "../generic";
import {
    BiDiBrowsingContextBaseNavigationInfo,
    BiDiBrowsingContextBrowsingContext,
    BiDiBrowsingContextDownload,
    BiDiBrowsingContextInfo,
    BiDiBrowsingContextNavigationInfo,
    BiDiBrowsingContextUserPromptType,
} from "../modules/browsing-context";
import { BiDiBrowserUserContext } from "../modules/browser";
import { BiDiSessionUserPromptHandlerType } from "../modules/session";

// browsingContext.ContextCreated
export type BiDiBrowsingContextContextCreatedEvent = {
    method: "browsingContext.contextCreated";
    params: BiDiBrowsingContextInfo;
};

// browsingContext.ContextDestroyed
export type BiDiBrowsingContextContextDestroyedEvent = {
    method: "browsingContext.contextDestroyed";
    params: BiDiBrowsingContextInfo;
};

// browsingContext.NavigationStarted
export type BiDiBrowsingContextNavigationStartedEvent = {
    method: "browsingContext.navigationStarted";
    params: BiDiBrowsingContextNavigationInfo;
};

// browsingContext.FragmentNavigated
export type BiDiBrowsingContextFragmentNavigatedEvent = {
    method: "browsingContext.fragmentNavigated";
    params: BiDiBrowsingContextNavigationInfo;
};

// browsingContext.HistoryUpdated
export type BiDiBrowsingContextHistoryUpdatedEvent = {
    method: "browsingContext.historyUpdated";
    params: BiDiBrowsingContextHistoryUpdatedParameters;
};

// browsingContext.HistoryUpdatedParameters
export type BiDiBrowsingContextHistoryUpdatedParameters = {
    context: BiDiBrowsingContextBrowsingContext;
    timestamp: JsUInt;
    url: string;
    userContext?: BiDiBrowserUserContext;
};

// browsingContext.DomContentLoaded
export type BiDiBrowsingContextDomContentLoadedEvent = {
    method: "browsingContext.domContentLoaded";
    params: BiDiBrowsingContextNavigationInfo;
};

// browsingContext.Load
export type BiDiBrowsingContextLoadEvent = {
    method: "browsingContext.load";
    params: BiDiBrowsingContextNavigationInfo;
};

// browsingContext.DownloadWillBegin
export type BiDiBrowsingContextDownloadWillBeginEvent = {
    method: "browsingContext.downloadWillBegin";
    params: BiDiBrowsingContextDownloadWillBeginParams;
};

// browsingContext.DownloadWillBeginParams
export type BiDiBrowsingContextDownloadWillBeginParams = {
    download: BiDiBrowsingContextDownload;
    suggestedFilename: string;
} & BiDiBrowsingContextBaseNavigationInfo;

// browsingContext.DownloadEnd
export type BiDiBrowsingContextDownloadEndEvent = {
    method: "browsingContext.downloadEnd";
    params: BiDiBrowsingContextDownloadEndParams;
};

// browsingContext.DownloadEndParams
export type BiDiBrowsingContextDownloadEndParams =
    | BiDiBrowsingContextDownloadCanceledParams
    | BiDiBrowsingContextDownloadCompleteParams;

// browsingContext.DownloadCanceledParams
export type BiDiBrowsingContextDownloadCanceledParams = {
    status: "canceled";
    download: BiDiBrowsingContextDownload;
} & BiDiBrowsingContextBaseNavigationInfo;

// browsingContext.DownloadCompleteParams
export type BiDiBrowsingContextDownloadCompleteParams = {
    status: "complete";
    download: BiDiBrowsingContextDownload;
    filepath: string | null;
} & BiDiBrowsingContextBaseNavigationInfo;

// browsingContext.NavigationAborted
export type BiDiBrowsingContextNavigationAbortedEvent = {
    method: "browsingContext.navigationAborted";
    params: BiDiBrowsingContextNavigationInfo;
};

// browsingContext.NavigationCommitted
export type BiDiBrowsingContextNavigationCommittedEvent = {
    method: "browsingContext.navigationCommitted";
    params: BiDiBrowsingContextNavigationInfo;
};

// browsingContext.NavigationFailed
export type BiDiBrowsingContextNavigationFailedEvent = {
    method: "browsingContext.navigationFailed";
    params: BiDiBrowsingContextNavigationInfo;
};

// browsingContext.UserPromptClosed
export type BiDiBrowsingContextUserPromptClosedEvent = {
    method: "browsingContext.userPromptClosed";
    params: BiDiBrowsingContextUserPromptClosedParameters;
};

// browsingContext.UserPromptClosedParameters
export type BiDiBrowsingContextUserPromptClosedParameters = {
    context: BiDiBrowsingContextBrowsingContext;
    accepted: boolean;
    type: BiDiBrowsingContextUserPromptType;
    userContext?: BiDiBrowserUserContext;
    userText?: string;
};

// browsingContext.UserPromptOpened
export type BiDiBrowsingContextUserPromptOpenedEvent = {
    method: "browsingContext.userPromptOpened";
    params: BiDiBrowsingContextUserPromptOpenedParameters;
};

// browsingContext.UserPromptOpenedParameters
export type BiDiBrowsingContextUserPromptOpenedParameters = {
    context: BiDiBrowsingContextBrowsingContext;
    handler: BiDiSessionUserPromptHandlerType;
    message: string;
    type: BiDiBrowsingContextUserPromptType;
    userContext?: BiDiBrowserUserContext;
    defaultValue?: string;
};

// BrowsingContextEvent
export type BiDiBrowsingContextEvent =
    | BiDiBrowsingContextContextCreatedEvent
    | BiDiBrowsingContextContextDestroyedEvent
    | BiDiBrowsingContextDomContentLoadedEvent
    | BiDiBrowsingContextDownloadEndEvent
    | BiDiBrowsingContextDownloadWillBeginEvent
    | BiDiBrowsingContextFragmentNavigatedEvent
    | BiDiBrowsingContextHistoryUpdatedEvent
    | BiDiBrowsingContextLoadEvent
    | BiDiBrowsingContextNavigationAbortedEvent
    | BiDiBrowsingContextNavigationCommittedEvent
    | BiDiBrowsingContextNavigationFailedEvent
    | BiDiBrowsingContextNavigationStartedEvent
    | BiDiBrowsingContextUserPromptClosedEvent
    | BiDiBrowsingContextUserPromptOpenedEvent;
