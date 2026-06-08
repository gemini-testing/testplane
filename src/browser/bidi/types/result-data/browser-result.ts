import { BiDiEmptyResult } from "../generic";
import { BiDiBrowserClientWindowInfo, BiDiBrowserUserContextInfo } from "../modules/browser";

// browser.CloseResult
export type BiDiBrowserCloseResult = BiDiEmptyResult;

// browser.CreateUserContextResult
export type BiDiBrowserCreateUserContextResult = BiDiBrowserUserContextInfo;

// browser.GetClientWindowsResult
export type BiDiBrowserGetClientWindowsResult = {
    clientWindows: BiDiBrowserClientWindowInfo[];
};

// browser.GetUserContextsResult
export type BiDiBrowserGetUserContextsResult = {
    userContexts: BiDiBrowserUserContextInfo[];
};

// browser.RemoveUserContextResult
export type BiDiBrowserRemoveUserContextResult = BiDiEmptyResult;

// browser.SetClientWindowStateResult
export type BiDiBrowserSetClientWindowStateResult = BiDiBrowserClientWindowInfo;

// browser.SetDownloadBehaviorResult
export type BiDiBrowserSetDownloadBehaviorResult = BiDiEmptyResult;

// BrowserResult
export type BiDiBrowserResult =
    | BiDiBrowserCloseResult
    | BiDiBrowserCreateUserContextResult
    | BiDiBrowserGetClientWindowsResult
    | BiDiBrowserGetUserContextsResult
    | BiDiBrowserRemoveUserContextResult
    | BiDiBrowserSetClientWindowStateResult
    | BiDiBrowserSetDownloadBehaviorResult;
