import { CDPConnection } from "../connection";
import { CDPEventEmitter } from "../emitter";
import type { CDPSessionId } from "../types";

export interface DomEvents {
    attributeModified: Record<string, unknown>;
    attributeRemoved: Record<string, unknown>;
    characterDataModified: Record<string, unknown>;
    childNodeCountUpdated: Record<string, unknown>;
    childNodeInserted: Record<string, unknown>;
    childNodeRemoved: Record<string, unknown>;
    documentUpdated: Record<string, unknown>;
    setChildNodes: Record<string, unknown>;
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Dom/ */
export class CDPDom extends CDPEventEmitter<DomEvents> {
    private readonly _connection: CDPConnection;

    public constructor(connection: CDPConnection) {
        super();

        this._connection = connection;
    }

    /** @param sessionId result of "Target.attachToTarget" */
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/DOM/#method-enable */
    async enable(sessionId: CDPSessionId): Promise<void> {
        return this._connection.request("DOM.enable", { sessionId });
    }

    /** @param sessionId result of "Target.attachToTarget" */
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/DOM/#method-disable */
    async disable(sessionId: CDPSessionId): Promise<void> {
        return this._connection.request("DOM.disable", { sessionId });
    }
}
