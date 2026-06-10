import { BiDiEmptyResult } from "../generic";
import { BiDiScriptEvaluateResult, BiDiScriptPreloadScript, BiDiScriptRealmInfo } from "../modules/script";

// script.AddPreloadScriptResult
export type BiDiScriptAddPreloadScriptResult = {
    script: BiDiScriptPreloadScript;
};

// script.CallFunctionResult
export type BiDiScriptCallFunctionResult = BiDiScriptEvaluateResult;

// script.DisownResult
export type BiDiScriptDisownResult = BiDiEmptyResult;

// script.GetRealmsResult
export type BiDiScriptGetRealmsResult = {
    realms: BiDiScriptRealmInfo[];
};

// script.RemovePreloadScriptResult
export type BiDiScriptRemovePreloadScriptResult = BiDiEmptyResult;

// ScriptResult
export type BiDiScriptResult =
    | BiDiScriptAddPreloadScriptResult
    | BiDiScriptCallFunctionResult
    | BiDiScriptDisownResult
    | BiDiScriptEvaluateResult
    | BiDiScriptGetRealmsResult
    | BiDiScriptRemovePreloadScriptResult;
