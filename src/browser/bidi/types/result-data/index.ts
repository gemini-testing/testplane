import { BiDiBrowserResult } from "./browser-result";
import { BiDiBrowsingContextResult } from "./browsing-context-result";
import { BiDiEmulationResult } from "./emulation-result";
import { BiDiInputResult } from "./input-result";
import { BiDiNetworkResult } from "./network-result";
import { BiDiScriptResult } from "./script-result";
import { BiDiSessionResult } from "./session-result";
import { BiDiStorageResult } from "./storage-result";
import { BiDiWebExtensionResult } from "./web-extension-result";

export * from "./browser-result";
export * from "./browsing-context-result";
export * from "./emulation-result";
export * from "./input-result";
export * from "./network-result";
export * from "./script-result";
export * from "./session-result";
export * from "./storage-result";
export * from "./web-extension-result";

// ResultData
export type BiDiResultData =
    | BiDiBrowserResult
    | BiDiBrowsingContextResult
    | BiDiEmulationResult
    | BiDiInputResult
    | BiDiNetworkResult
    | BiDiScriptResult
    | BiDiSessionResult
    | BiDiStorageResult
    | BiDiWebExtensionResult;
