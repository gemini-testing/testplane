import { BiDiBrowsingContextBrowsingContext } from "../modules/browsing-context";
import { BiDiBrowserUserContext } from "../modules/browser";
import { BiDiScriptSharedReference } from "../modules/script";

// input.FileDialogOpened
export type BiDiInputFileDialogOpenedEvent = {
    method: "input.fileDialogOpened";
    params: BiDiInputFileDialogInfo;
};

// input.FileDialogInfo
export type BiDiInputFileDialogInfo = {
    context: BiDiBrowsingContextBrowsingContext;
    userContext?: BiDiBrowserUserContext;
    element?: BiDiScriptSharedReference;
    multiple: boolean;
};

// InputEvent
export type BiDiInputEvent = BiDiInputFileDialogOpenedEvent;
