import { BiDiEmptyResult } from "../generic";
import {
    BiDiBrowsingContextBrowsingContext,
    BiDiBrowsingContextInfoList,
    BiDiBrowsingContextNavigation,
    BiDiBrowsingContextScreencast,
} from "../modules/browsing-context";
import { BiDiBrowserUserContext } from "../modules/browser";
import { BiDiScriptNodeRemoteValue } from "../modules/script";

// browsingContext.ActivateResult
export type BiDiBrowsingContextActivateResult = BiDiEmptyResult;

// browsingContext.CaptureScreenshotResult
export type BiDiBrowsingContextCaptureScreenshotResult = {
    data: string;
};

// browsingContext.CloseResult
export type BiDiBrowsingContextCloseResult = BiDiEmptyResult;

// browsingContext.CreateResult
export type BiDiBrowsingContextCreateResult = {
    context: BiDiBrowsingContextBrowsingContext;
    userContext?: BiDiBrowserUserContext;
};

// browsingContext.GetTreeResult
export type BiDiBrowsingContextGetTreeResult = {
    contexts: BiDiBrowsingContextInfoList;
};

// browsingContext.HandleUserPromptResult
export type BiDiBrowsingContextHandleUserPromptResult = BiDiEmptyResult;

// browsingContext.LocateNodesResult
export type BiDiBrowsingContextLocateNodesResult = {
    nodes: BiDiScriptNodeRemoteValue[];
};

// browsingContext.NavigateResult
export type BiDiBrowsingContextNavigateResult = {
    navigation: BiDiBrowsingContextNavigation | null;
    url: string;
};

// browsingContext.PrintResult
export type BiDiBrowsingContextPrintResult = {
    data: string;
};

// browsingContext.ReloadResult
export type BiDiBrowsingContextReloadResult = BiDiBrowsingContextNavigateResult;

// browsingContext.SetBypassCSPResult
export type BiDiBrowsingContextSetBypassCSPResult = BiDiEmptyResult;

// browsingContext.SetViewportResult
export type BiDiBrowsingContextSetViewportResult = BiDiEmptyResult;

// browsingContext.StartScreencastResult
export type BiDiBrowsingContextStartScreencastResult = {
    screencast: BiDiBrowsingContextScreencast;
    path: string;
};

// browsingContext.StopScreencastResult
export type BiDiBrowsingContextStopScreencastResult = {
    path: string;
    error?: string;
};

// browsingContext.TraverseHistoryResult
export type BiDiBrowsingContextTraverseHistoryResult = BiDiEmptyResult;

// BrowsingContextResult
export type BiDiBrowsingContextResult =
    | BiDiBrowsingContextActivateResult
    | BiDiBrowsingContextCaptureScreenshotResult
    | BiDiBrowsingContextCloseResult
    | BiDiBrowsingContextCreateResult
    | BiDiBrowsingContextGetTreeResult
    | BiDiBrowsingContextHandleUserPromptResult
    | BiDiBrowsingContextLocateNodesResult
    | BiDiBrowsingContextNavigateResult
    | BiDiBrowsingContextPrintResult
    | BiDiBrowsingContextReloadResult
    | BiDiBrowsingContextSetBypassCSPResult
    | BiDiBrowsingContextSetViewportResult
    | BiDiBrowsingContextStartScreencastResult
    | BiDiBrowsingContextStopScreencastResult
    | BiDiBrowsingContextTraverseHistoryResult;
