import { JsInt, JsUInt } from "../generic";

// browser.ClientWindow
export type BiDiBrowserClientWindow = string;

// browser.ClientWindowInfo
export type BiDiBrowserClientWindowInfo = {
    active: boolean;
    clientWindow: BiDiBrowserClientWindow;
    height: JsUInt;
    state: "fullscreen" | "maximized" | "minimized" | "normal";
    width: JsUInt;
    x: JsInt;
    y: JsInt;
};

// browser.UserContext
export type BiDiBrowserUserContext = string;

// browser.UserContextInfo
export type BiDiBrowserUserContextInfo = {
    userContext: BiDiBrowserUserContext;
};

// browser.DownloadBehavior
export type BiDiBrowserDownloadBehavior = BiDiBrowserDownloadBehaviorAllowed | BiDiBrowserDownloadBehaviorDenied;

// browser.DownloadBehaviorAllowed
export type BiDiBrowserDownloadBehaviorAllowed = {
    type: "allowed";
    destinationFolder: string;
};

// browser.DownloadBehaviorDenied
export type BiDiBrowserDownloadBehaviorDenied = {
    type: "denied";
};
