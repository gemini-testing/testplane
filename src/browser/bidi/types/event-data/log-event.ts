import { BiDiLogLogEntry } from "../modules/log";

// log.EntryAdded
export type BiDiLogEntryAddedEvent = {
    method: "log.entryAdded";
    params: BiDiLogLogEntry;
};

// LogEvent
export type BiDiLogEvent = BiDiLogEntryAddedEvent;
