import { JsInt, JsUInt, BiDiEmptyParams } from "../generic";
import { BiDiBrowserDownloadBehavior, BiDiBrowserClientWindow, BiDiBrowserUserContext } from "../modules/browser";
import { BiDiSessionProxyConfiguration, BiDiSessionUserPromptHandler } from "../modules/session";

// browser.Close
export type BiDiBrowserCloseCommand = {
    method: "browser.close";
    params: BiDiEmptyParams;
};

// browser.CreateUserContext
export type BiDiBrowserCreateUserContextCommand = {
    method: "browser.createUserContext";
    params: BiDiBrowserCreateUserContextParameters;
};

// browser.CreateUserContextParameters
export type BiDiBrowserCreateUserContextParameters = {
    acceptInsecureCerts?: boolean;
    proxy?: BiDiSessionProxyConfiguration;
    unhandledPromptBehavior?: BiDiSessionUserPromptHandler;
};

// browser.GetClientWindows
export type BiDiBrowserGetClientWindowsCommand = {
    method: "browser.getClientWindows";
    params: BiDiEmptyParams;
};

// browser.GetUserContexts
export type BiDiBrowserGetUserContextsCommand = {
    method: "browser.getUserContexts";
    params: BiDiEmptyParams;
};

// browser.RemoveUserContext
export type BiDiBrowserRemoveUserContextCommand = {
    method: "browser.removeUserContext";
    params: BiDiBrowserRemoveUserContextParameters;
};

// browser.RemoveUserContextParameters
export type BiDiBrowserRemoveUserContextParameters = {
    userContext: BiDiBrowserUserContext;
};

// browser.SetClientWindowState
export type BiDiBrowserSetClientWindowStateCommand = {
    method: "browser.setClientWindowState";
    params: BiDiBrowserSetClientWindowStateParameters;
};

// browser.SetClientWindowStateParameters
export type BiDiBrowserSetClientWindowStateParameters = {
    clientWindow: BiDiBrowserClientWindow;
} & (BiDiBrowserClientWindowNamedState | BiDiBrowserClientWindowRectState);

// browser.ClientWindowNamedState
export type BiDiBrowserClientWindowNamedState = {
    state: "fullscreen" | "maximized" | "minimized";
};

// browser.ClientWindowRectState
export type BiDiBrowserClientWindowRectState = {
    state: "normal";
    width?: JsUInt;
    height?: JsUInt;
    x?: JsInt;
    y?: JsInt;
};

// browser.SetDownloadBehavior
export type BiDiBrowserSetDownloadBehaviorCommand = {
    method: "browser.setDownloadBehavior";
    params: BiDiBrowserSetDownloadBehaviorParameters;
};

// browser.SetDownloadBehaviorParameters
export type BiDiBrowserSetDownloadBehaviorParameters = {
    downloadBehavior: BiDiBrowserDownloadBehavior | null;
    userContexts?: BiDiBrowserUserContext[];
};

// BrowserCommand
export type BiDiBrowserCommand =
    | BiDiBrowserCloseCommand
    | BiDiBrowserCreateUserContextCommand
    | BiDiBrowserGetClientWindowsCommand
    | BiDiBrowserGetUserContextsCommand
    | BiDiBrowserRemoveUserContextCommand
    | BiDiBrowserSetClientWindowStateCommand
    | BiDiBrowserSetDownloadBehaviorCommand;
