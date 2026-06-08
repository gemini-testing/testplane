import { BiDiBrowsingContextBrowsingContext } from "../modules/browsing-context";
import { BiDiInputSourceActions } from "../modules/input";
import { BiDiScriptSharedReference } from "../modules/script";

// input.PerformActions
export type BiDiInputPerformActionsCommand = {
    method: "input.performActions";
    params: BiDiInputPerformActionsParameters;
};

// input.PerformActionsParameters
export type BiDiInputPerformActionsParameters = {
    context: BiDiBrowsingContextBrowsingContext;
    actions: BiDiInputSourceActions[];
};

// input.ReleaseActions
export type BiDiInputReleaseActionsCommand = {
    method: "input.releaseActions";
    params: BiDiInputReleaseActionsParameters;
};

// input.ReleaseActionsParameters
export type BiDiInputReleaseActionsParameters = {
    context: BiDiBrowsingContextBrowsingContext;
};

// input.SetFiles
export type BiDiInputSetFilesCommand = {
    method: "input.setFiles";
    params: BiDiInputSetFilesParameters;
};

// input.SetFilesParameters
export type BiDiInputSetFilesParameters = {
    context: BiDiBrowsingContextBrowsingContext;
    element: BiDiScriptSharedReference;
    files: string[];
};

// InputCommand
export type BiDiInputCommand =
    | BiDiInputPerformActionsCommand
    | BiDiInputReleaseActionsCommand
    | BiDiInputSetFilesCommand;
