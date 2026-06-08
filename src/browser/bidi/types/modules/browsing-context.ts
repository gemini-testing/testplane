import { JsUInt } from "../generic";
import { BiDiBrowserClientWindow, BiDiBrowserUserContext } from "./browser";

// browsingContext.BrowsingContext
export type BiDiBrowsingContextBrowsingContext = string;

// browsingContext.InfoList
export type BiDiBrowsingContextInfoList = BiDiBrowsingContextInfo[];

// browsingContext.Info
export type BiDiBrowsingContextInfo = {
    children: BiDiBrowsingContextInfoList | null;
    clientWindow: BiDiBrowserClientWindow;
    context: BiDiBrowsingContextBrowsingContext;
    originalOpener: BiDiBrowsingContextBrowsingContext | null;
    url: string;
    userContext: BiDiBrowserUserContext;
    parent?: BiDiBrowsingContextBrowsingContext | null;
};

// browsingContext.Locator
export type BiDiBrowsingContextLocator =
    | BiDiBrowsingContextAccessibilityLocator
    | BiDiBrowsingContextCssLocator
    | BiDiBrowsingContextContextLocator
    | BiDiBrowsingContextInnerTextLocator
    | BiDiBrowsingContextXPathLocator;

// browsingContext.AccessibilityLocator
export type BiDiBrowsingContextAccessibilityLocator = {
    type: "accessibility";
    value: {
        name?: string;
        role?: string;
    };
};

// browsingContext.CssLocator
export type BiDiBrowsingContextCssLocator = {
    type: "css";
    value: string;
};

// browsingContext.ContextLocator
export type BiDiBrowsingContextContextLocator = {
    type: "context";
    value: {
        context: BiDiBrowsingContextBrowsingContext;
    };
};

// browsingContext.InnerTextLocator
export type BiDiBrowsingContextInnerTextLocator = {
    type: "innerText";
    value: string;
    ignoreCase?: boolean;
    matchType?: "full" | "partial";
    maxDepth?: JsUInt;
};

// browsingContext.XPathLocator
export type BiDiBrowsingContextXPathLocator = {
    type: "xpath";
    value: string;
};

// browsingContext.Navigation
export type BiDiBrowsingContextNavigation = string;

// browsingContext.Download
export type BiDiBrowsingContextDownload = string;

// browsingContext.BaseNavigationInfo
export type BiDiBrowsingContextBaseNavigationInfo = {
    context: BiDiBrowsingContextBrowsingContext;
    navigation: BiDiBrowsingContextNavigation | null;
    timestamp: JsUInt;
    url: string;
    userContext?: BiDiBrowserUserContext;
};

// browsingContext.NavigationInfo
export type BiDiBrowsingContextNavigationInfo = BiDiBrowsingContextBaseNavigationInfo;

// browsingContext.ReadinessState
export type BiDiBrowsingContextReadinessState = "none" | "interactive" | "complete";

// browsingContext.UserPromptType
export type BiDiBrowsingContextUserPromptType = "alert" | "beforeunload" | "confirm" | "prompt";

// browsingContext.Screencast
export type BiDiBrowsingContextScreencast = string;
