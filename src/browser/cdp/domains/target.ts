import { CDPEventEmitter } from "../emitter";
import { CDPConnection } from "../connection";
import type { CDPBrowserContextId, CDPSessionId, CDPTargetId, CDPTargetInfo } from "../types";

interface GetBrowserContextsResponse {
    browserContextIds: CDPBrowserContextId[];
}

interface CreateBrowserContextResponse {
    browserContextId: CDPBrowserContextId;
}

interface CreateTargetResponse {
    targetId: CDPTargetId;
}

interface CreateTargetResponse {
    targetId: CDPTargetId;
}

interface AttachToTargetResponse {
    sessionId: CDPSessionId;
}

interface GetTargetsResponse {
    targetInfos: CDPTargetInfo[];
}

interface SetAutoAttachRequest {
    autoAttach: boolean;
    waitForDebuggerOnStart: boolean;
    flatten?: boolean;
}

export interface TargetEvents {
    receivedMessageFromTarget: {
        sessionId: CDPSessionId;
        message: string;
    };
    targetCrashed: {
        targetId: CDPTargetId;
        /** Termination status type. */
        status: string;
        /** Termination error code. */
        errorCode: number;
    };
    targetCreated: {
        targetInfo: CDPTargetInfo;
    };
    targetDestroyed: {
        targetId: CDPTargetId;
    };
    targetInfoChanged: {
        targetInfo: CDPTargetInfo;
    };
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Target/ */
export class CDPTarget extends CDPEventEmitter<TargetEvents> {
    private readonly _connection: CDPConnection;

    public constructor(connection: CDPConnection) {
        super();

        this._connection = connection;
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Target/#method-getBrowserContexts */
    async getBrowserContexts(): Promise<GetBrowserContextsResponse> {
        return this._connection.request("Target.getBrowserContexts");
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Target/#method-createBrowserContext */
    async createBrowserContext(): Promise<CreateBrowserContextResponse> {
        return this._connection.request("Target.createBrowserContext");
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Target/#method-disposeBrowserContext */
    async disposeBrowserContext(browserContextId: CDPBrowserContextId): Promise<void> {
        return this._connection.request("Target.disposeBrowserContext", { params: { browserContextId } });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Target/#method-createTarget */
    async createTarget({
        url = "about:blank",
        browserContextId,
    }: {
        url?: string;
        browserContextId?: CDPBrowserContextId;
    }): Promise<CreateTargetResponse> {
        return this._connection.request("Target.createTarget", { params: { url, browserContextId } });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Target/#method-closeTarget */
    async closeTarget(targetId: CDPTargetId): Promise<void> {
        return this._connection.request("Target.closeTarget", { params: { targetId } });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Target/#method-activateTarget */
    async activateTarget(targetId: CDPTargetId): Promise<void> {
        return this._connection.request("Target.activateTarget", { params: { targetId } });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Target/#method-attachToTarget */
    async attachToTarget(targetId: CDPTargetId): Promise<AttachToTargetResponse> {
        return this._connection.request("Target.attachToTarget", { params: { targetId, flatten: true } });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Target/#method-detachFromTarget */
    async detachFromTarget(sessionId: CDPSessionId): Promise<AttachToTargetResponse["sessionId"]> {
        return this._connection.request("Target.detachFromTarget", { params: { sessionId } });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Target/#method-getTargets */
    async getTargets(): Promise<GetTargetsResponse> {
        return this._connection.request("Target.getTargets");
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Target/#method-setAutoAttach */
    async setAutoAttach(sessionId: CDPSessionId, params: SetAutoAttachRequest): Promise<void> {
        return this._connection.request("Target.setAutoAttach", { sessionId, params });
    }
}
