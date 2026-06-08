import { JsInt, JsUInt } from "../generic";
import {
    BiDiBrowsingContextBrowsingContext,
    BiDiBrowsingContextLocator,
    BiDiBrowsingContextReadinessState,
    BiDiBrowsingContextScreencast,
} from "../modules/browsing-context";
import { BiDiBrowserUserContext } from "../modules/browser";
import { BiDiScriptSerializationOptions, BiDiScriptSharedReference } from "../modules/script";

// browsingContext.Activate
export type BiDiBrowsingContextActivateCommand = {
    method: "browsingContext.activate";
    params: BiDiBrowsingContextActivateParameters;
};

// browsingContext.ActivateParameters
export type BiDiBrowsingContextActivateParameters = {
    context: BiDiBrowsingContextBrowsingContext;
};

// browsingContext.CaptureScreenshot
export type BiDiBrowsingContextCaptureScreenshotCommand = {
    method: "browsingContext.captureScreenshot";
    params: BiDiBrowsingContextCaptureScreenshotParameters;
};

// browsingContext.CaptureScreenshotParameters
export type BiDiBrowsingContextCaptureScreenshotParameters = {
    context: BiDiBrowsingContextBrowsingContext;
    origin?: "viewport" | "document";
    format?: BiDiBrowsingContextImageFormat;
    clip?: BiDiBrowsingContextClipRectangle;
};

// browsingContext.ImageFormat
export type BiDiBrowsingContextImageFormat = {
    type: string;
    quality?: number;
};

// browsingContext.ClipRectangle
export type BiDiBrowsingContextClipRectangle =
    | BiDiBrowsingContextBoxClipRectangle
    | BiDiBrowsingContextElementClipRectangle;

// browsingContext.ElementClipRectangle
export type BiDiBrowsingContextElementClipRectangle = {
    type: "element";
    element: BiDiScriptSharedReference;
};

// browsingContext.BoxClipRectangle
export type BiDiBrowsingContextBoxClipRectangle = {
    type: "box";
    x: number;
    y: number;
    width: number;
    height: number;
};

// browsingContext.Close
export type BiDiBrowsingContextCloseCommand = {
    method: "browsingContext.close";
    params: BiDiBrowsingContextCloseParameters;
};

// browsingContext.CloseParameters
export type BiDiBrowsingContextCloseParameters = {
    context: BiDiBrowsingContextBrowsingContext;
    promptUnload?: boolean;
};

// browsingContext.Create
export type BiDiBrowsingContextCreateCommand = {
    method: "browsingContext.create";
    params: BiDiBrowsingContextCreateParameters;
};

// browsingContext.CreateType
export type BiDiBrowsingContextCreateType = "tab" | "window";

// browsingContext.CreateParameters
export type BiDiBrowsingContextCreateParameters = {
    type: BiDiBrowsingContextCreateType;
    referenceContext?: BiDiBrowsingContextBrowsingContext;
    background?: boolean;
    userContext?: BiDiBrowserUserContext;
};

// browsingContext.GetTree
export type BiDiBrowsingContextGetTreeCommand = {
    method: "browsingContext.getTree";
    params: BiDiBrowsingContextGetTreeParameters;
};

// browsingContext.GetTreeParameters
export type BiDiBrowsingContextGetTreeParameters = {
    maxDepth?: JsUInt;
    root?: BiDiBrowsingContextBrowsingContext;
};

// browsingContext.HandleUserPrompt
export type BiDiBrowsingContextHandleUserPromptCommand = {
    method: "browsingContext.handleUserPrompt";
    params: BiDiBrowsingContextHandleUserPromptParameters;
};

// browsingContext.HandleUserPromptParameters
export type BiDiBrowsingContextHandleUserPromptParameters = {
    context: BiDiBrowsingContextBrowsingContext;
    accept?: boolean;
    userText?: string;
};

// browsingContext.LocateNodes
export type BiDiBrowsingContextLocateNodesCommand = {
    method: "browsingContext.locateNodes";
    params: BiDiBrowsingContextLocateNodesParameters;
};

// browsingContext.LocateNodesParameters
export type BiDiBrowsingContextLocateNodesParameters = {
    context: BiDiBrowsingContextBrowsingContext;
    locator: BiDiBrowsingContextLocator;
    maxNodeCount?: JsUInt;
    serializationOptions?: BiDiScriptSerializationOptions;
    startNodes?: BiDiScriptSharedReference[];
};

// browsingContext.Navigate
export type BiDiBrowsingContextNavigateCommand = {
    method: "browsingContext.navigate";
    params: BiDiBrowsingContextNavigateParameters;
};

// browsingContext.NavigateParameters
export type BiDiBrowsingContextNavigateParameters = {
    context: BiDiBrowsingContextBrowsingContext;
    url: string;
    wait?: BiDiBrowsingContextReadinessState;
};

// browsingContext.Print
export type BiDiBrowsingContextPrintCommand = {
    method: "browsingContext.print";
    params: BiDiBrowsingContextPrintParameters;
};

// browsingContext.PrintParameters
export type BiDiBrowsingContextPrintParameters = {
    context: BiDiBrowsingContextBrowsingContext;
    background?: boolean;
    margin?: BiDiBrowsingContextPrintMarginParameters;
    orientation?: "portrait" | "landscape";
    page?: BiDiBrowsingContextPrintPageParameters;
    pageRanges?: (JsUInt | string)[];
    scale?: number;
    shrinkToFit?: boolean;
};

// browsingContext.PrintMarginParameters
export type BiDiBrowsingContextPrintMarginParameters = {
    bottom?: number;
    left?: number;
    right?: number;
    top?: number;
};

// browsingContext.PrintPageParameters
export type BiDiBrowsingContextPrintPageParameters = {
    height?: number;
    width?: number;
};

// browsingContext.Reload
export type BiDiBrowsingContextReloadCommand = {
    method: "browsingContext.reload";
    params: BiDiBrowsingContextReloadParameters;
};

// browsingContext.ReloadParameters
export type BiDiBrowsingContextReloadParameters = {
    context: BiDiBrowsingContextBrowsingContext;
    ignoreCache?: boolean;
    wait?: BiDiBrowsingContextReadinessState;
};

// browsingContext.SetBypassCSP
export type BiDiBrowsingContextSetBypassCSPCommand = {
    method: "browsingContext.setBypassCSP";
    params: BiDiBrowsingContextSetBypassCSPParameters;
};

// browsingContext.SetBypassCSPParameters
export type BiDiBrowsingContextSetBypassCSPParameters = {
    bypass: true | null;
    contexts?: BiDiBrowsingContextBrowsingContext[];
    userContexts?: BiDiBrowserUserContext[];
};

// browsingContext.SetViewport
export type BiDiBrowsingContextSetViewportCommand = {
    method: "browsingContext.setViewport";
    params: BiDiBrowsingContextSetViewportParameters;
};

// browsingContext.SetViewportParameters
export type BiDiBrowsingContextSetViewportParameters = {
    context?: BiDiBrowsingContextBrowsingContext;
    viewport?: BiDiBrowsingContextViewport | null;
    devicePixelRatio?: number | null;
    userContexts?: BiDiBrowserUserContext[];
};

// browsingContext.Viewport
export type BiDiBrowsingContextViewport = {
    width: JsUInt;
    height: JsUInt;
};

// browsingContext.StartScreencast
export type BiDiBrowsingContextStartScreencastCommand = {
    method: "browsingContext.startScreencast";
    params: BiDiBrowsingContextStartScreencastParameters;
};

// browsingContext.StartScreencastParameters
export type BiDiBrowsingContextStartScreencastParameters = {
    context: BiDiBrowsingContextBrowsingContext;
    mimeType?: string;
    video?: BiDiBrowsingContextMediaTrackConstraints;
    audio?: boolean;
};

// browsingContext.MediaTrackConstraints
export type BiDiBrowsingContextMediaTrackConstraints = {
    width?: JsUInt;
    height?: JsUInt;
    frameRate?: JsUInt;
};

// browsingContext.StopScreencast
export type BiDiBrowsingContextStopScreencastCommand = {
    method: "browsingContext.stopScreencast";
    params: BiDiBrowsingContextStopScreencastParameters;
};

// browsingContext.StopScreencastParameters
export type BiDiBrowsingContextStopScreencastParameters = {
    screencast: BiDiBrowsingContextScreencast;
};

// browsingContext.TraverseHistory
export type BiDiBrowsingContextTraverseHistoryCommand = {
    method: "browsingContext.traverseHistory";
    params: BiDiBrowsingContextTraverseHistoryParameters;
};

// browsingContext.TraverseHistoryParameters
export type BiDiBrowsingContextTraverseHistoryParameters = {
    context: BiDiBrowsingContextBrowsingContext;
    delta: JsInt;
};

// BrowsingContextCommand
export type BiDiBrowsingContextCommand =
    | BiDiBrowsingContextActivateCommand
    | BiDiBrowsingContextCaptureScreenshotCommand
    | BiDiBrowsingContextCloseCommand
    | BiDiBrowsingContextCreateCommand
    | BiDiBrowsingContextGetTreeCommand
    | BiDiBrowsingContextHandleUserPromptCommand
    | BiDiBrowsingContextLocateNodesCommand
    | BiDiBrowsingContextNavigateCommand
    | BiDiBrowsingContextPrintCommand
    | BiDiBrowsingContextReloadCommand
    | BiDiBrowsingContextSetBypassCSPCommand
    | BiDiBrowsingContextSetViewportCommand
    | BiDiBrowsingContextStartScreencastCommand
    | BiDiBrowsingContextStopScreencastCommand
    | BiDiBrowsingContextTraverseHistoryCommand;
