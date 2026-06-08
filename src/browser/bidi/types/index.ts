import { JsUInt } from "./generic";
import { BiDiCommandData } from "./command-data";
import { BiDiResultData } from "./result-data";
import { BiDiEventData } from "./event-data";

export * from "./generic";
export * from "./command-data";
export * from "./result-data";
export * from "./event-data";
export * from "./modules";

// Command = { id: js-uint, CommandData, Extensible }
export type BiDiCommand = {
    id: JsUInt;
} & BiDiCommandData;

// Message = CommandResponse / ErrorResponse / Event
export type BiDiMessage = BiDiCommandResponse | BiDiErrorResponse | BiDiEvent;

// CommandResponse = { type: "success", id: js-uint, result: ResultData, Extensible }
export type BiDiCommandResponse = {
    type: "success";
    id: JsUInt;
    result: BiDiResultData;
};

// ErrorResponse = { type: "error", id: js-uint / null, error: ErrorCode, message: text, ? stacktrace: text, Extensible }
export type BiDiErrorResponse = {
    type: "error";
    id: JsUInt | null;
    error: BiDiErrorCode;
    message: string;
    stacktrace?: string;
};

// Event = { type: "event", EventData, Extensible }
export type BiDiEvent = {
    type: "event";
} & BiDiEventData;

// ErrorCode = "invalid argument" / ...
export type BiDiErrorCode =
    | "invalid argument"
    | "invalid selector"
    | "invalid session id"
    | "invalid web extension"
    | "move target out of bounds"
    | "no such alert"
    | "no such network collector"
    | "no such element"
    | "no such frame"
    | "no such handle"
    | "no such history entry"
    | "no such intercept"
    | "no such network data"
    | "no such node"
    | "no such request"
    | "no such screencast"
    | "no such script"
    | "no such storage partition"
    | "no such user context"
    | "no such web extension"
    | "session not created"
    | "unable to capture screen"
    | "unable to close browser"
    | "unable to set cookie"
    | "unable to set file input"
    | "unavailable network data"
    | "underspecified storage partition"
    | "unknown command"
    | "unknown error"
    | "unsupported operation";
