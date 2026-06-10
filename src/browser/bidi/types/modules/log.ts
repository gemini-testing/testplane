import { JsUInt } from "../generic";
import { BiDiScriptRemoteValue, BiDiScriptSource, BiDiScriptStackTrace } from "./script";

// log.Level
export type BiDiLogLevel = "debug" | "info" | "warn" | "error";

// log.Entry
export type BiDiLogLogEntry = BiDiLogGenericLogEntry | BiDiLogConsoleLogEntry | BiDiLogJavascriptLogEntry;

// log.BaseLogEntry
export type BiDiLogBaseLogEntry = {
    level: BiDiLogLevel;
    source: BiDiScriptSource;
    text: string | null;
    timestamp: JsUInt;
    stackTrace?: BiDiScriptStackTrace;
};

// log.GenericLogEntry
export type BiDiLogGenericLogEntry = BiDiLogBaseLogEntry & {
    type: string;
};

// log.ConsoleLogEntry
export type BiDiLogConsoleLogEntry = BiDiLogBaseLogEntry & {
    type: "console";
    method: string;
    args: BiDiScriptRemoteValue[];
};

// log.JavascriptLogEntry
export type BiDiLogJavascriptLogEntry = BiDiLogBaseLogEntry & {
    type: "javascript";
};
