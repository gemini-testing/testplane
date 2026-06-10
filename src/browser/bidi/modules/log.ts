import { BIDIEmitter } from "../emitter";
import type { BiDiLogLogEntry } from "../types";

export interface BiDiLogEvents {
    entryAdded: BiDiLogLogEntry;
}

/** @link https://www.w3.org/TR/webdriver-bidi/#module-log */
export class BiDiLog extends BIDIEmitter<BiDiLogEvents> {}
