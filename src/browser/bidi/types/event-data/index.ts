import { BiDiBrowsingContextEvent } from "./browsing-context-event";
import { BiDiInputEvent } from "./input-event";
import { BiDiLogEvent } from "./log-event";
import { BiDiNetworkEvent } from "./network-event";
import { BiDiScriptEvent } from "./script-event";

export * from "./browsing-context-event";
export * from "./input-event";
export * from "./log-event";
export * from "./network-event";
export * from "./script-event";

// EventData
export type BiDiEventData =
    | BiDiBrowsingContextEvent
    | BiDiInputEvent
    | BiDiLogEvent
    | BiDiNetworkEvent
    | BiDiScriptEvent;
