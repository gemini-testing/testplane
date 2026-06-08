import { BiDiBrowsingContextBrowsingContext } from "../modules/browsing-context";
import { BiDiBrowserUserContext } from "../modules/browser";
import {
    BiDiScriptChannelValue,
    BiDiScriptHandle,
    BiDiScriptLocalValue,
    BiDiScriptPreloadScript,
    BiDiScriptRealmType,
    BiDiScriptResultOwnership,
    BiDiScriptSerializationOptions,
    BiDiScriptTarget,
} from "../modules/script";

// script.AddPreloadScript
export type BiDiScriptAddPreloadScriptCommand = {
    method: "script.addPreloadScript";
    params: BiDiScriptAddPreloadScriptParameters;
};

// script.AddPreloadScriptParameters
export type BiDiScriptAddPreloadScriptParameters = {
    functionDeclaration: string;
    arguments?: BiDiScriptChannelValue[];
    contexts?: BiDiBrowsingContextBrowsingContext[];
    userContexts?: BiDiBrowserUserContext[];
    sandbox?: string;
};

// script.CallFunction
export type BiDiScriptCallFunctionCommand = {
    method: "script.callFunction";
    params: BiDiScriptCallFunctionParameters;
};

// script.CallFunctionParameters
export type BiDiScriptCallFunctionParameters = {
    functionDeclaration: string;
    awaitPromise: boolean;
    target: BiDiScriptTarget;
    arguments?: BiDiScriptLocalValue[];
    resultOwnership?: BiDiScriptResultOwnership;
    serializationOptions?: BiDiScriptSerializationOptions;
    this?: BiDiScriptLocalValue;
    userActivation?: boolean;
};

// script.Disown
export type BiDiScriptDisownCommand = {
    method: "script.disown";
    params: BiDiScriptDisownParameters;
};

// script.DisownParameters
export type BiDiScriptDisownParameters = {
    handles: BiDiScriptHandle[];
    target: BiDiScriptTarget;
};

// script.Evaluate
export type BiDiScriptEvaluateCommand = {
    method: "script.evaluate";
    params: BiDiScriptEvaluateParameters;
};

// script.EvaluateParameters
export type BiDiScriptEvaluateParameters = {
    expression: string;
    target: BiDiScriptTarget;
    awaitPromise: boolean;
    resultOwnership?: BiDiScriptResultOwnership;
    serializationOptions?: BiDiScriptSerializationOptions;
    userActivation?: boolean;
};

// script.GetRealms
export type BiDiScriptGetRealmsCommand = {
    method: "script.getRealms";
    params: BiDiScriptGetRealmsParameters;
};

// script.GetRealmsParameters
export type BiDiScriptGetRealmsParameters = {
    context?: BiDiBrowsingContextBrowsingContext;
    type?: BiDiScriptRealmType;
};

// script.RemovePreloadScript
export type BiDiScriptRemovePreloadScriptCommand = {
    method: "script.removePreloadScript";
    params: BiDiScriptRemovePreloadScriptParameters;
};

// script.RemovePreloadScriptParameters
export type BiDiScriptRemovePreloadScriptParameters = {
    script: BiDiScriptPreloadScript;
};

// ScriptCommand
export type BiDiScriptCommand =
    | BiDiScriptAddPreloadScriptCommand
    | BiDiScriptCallFunctionCommand
    | BiDiScriptDisownCommand
    | BiDiScriptEvaluateCommand
    | BiDiScriptGetRealmsCommand
    | BiDiScriptRemovePreloadScriptCommand;
