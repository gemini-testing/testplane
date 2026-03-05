import { CDPEventEmitter } from "../emitter";

export interface FetchEvents {
    authRequired: Record<string, unknown>;
    requestPaused: Record<string, unknown>;
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Fetch/ */
export class CDFetch extends CDPEventEmitter<FetchEvents> {
    public constructor() {
        super();
    }
}
