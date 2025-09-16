import { CDPConnection } from "../connection";
import { CDPEventEmitter } from "../emitter";
import type { CDPCSSStyleSheetHeader, CDPSessionId, CDPStyleSheetId } from "../types";

interface StopRuleUsageTrackingResponse {
    ruleUsage: Array<{
        styleSheetId: CDPStyleSheetId;
        startOffset: number;
        endOffset: number;
        used: boolean;
    }>;
}

export interface CssEvents {
    fontsUpdated: {
        font: Record<string, unknown>;
    };
    mediaQueryResultChanged: Record<string, never>;
    styleSheetAdded: {
        header: CDPCSSStyleSheetHeader;
    };
    styleSheetChanged: {
        styleSheetId: CDPStyleSheetId;
    };
    styleSheetRemoved: {
        styleSheetId: CDPStyleSheetId;
    };
}

/** @link https://chromedevtools.github.io/devtools-protocol/tot/CSS/ */
export class CDPCss extends CDPEventEmitter<CssEvents> {
    private readonly _connection: CDPConnection;

    public constructor(connection: CDPConnection) {
        super();

        this._connection = connection;
    }

    /** @param sessionId result of "Target.attachToTarget" */
    /** @link https://chromedevtools.github.io/devtools-protocol/tot/CSS/#method-enable */
    async enable(sessionId: CDPSessionId): Promise<void> {
        return this._connection.request("CSS.enable", { sessionId });
    }

    /** @param sessionId result of "Target.attachToTarget" */
    /** @link https://chromedevtools.github.io/devtools-protocol/tot/CSS/#method-disable */
    async disable(sessionId: CDPSessionId): Promise<void> {
        return this._connection.request("CSS.disable", { sessionId });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/tot/CSS/#method-getStyleSheetText */
    async getStyleSheetText(sessionId: CDPSessionId, styleSheetId: CDPStyleSheetId): Promise<{ text: string }> {
        return this._connection.request("CSS.getStyleSheetText", { sessionId, params: { styleSheetId } });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/tot/CSS/#method-startRuleUsageTracking */
    async startRuleUsageTracking(sessionId: CDPSessionId): Promise<void> {
        return this._connection.request("CSS.startRuleUsageTracking", { sessionId });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/tot/CSS/#method-stopRuleUsageTracking */
    async stopRuleUsageTracking(sessionId: CDPSessionId): Promise<StopRuleUsageTrackingResponse> {
        return this._connection.request("CSS.stopRuleUsageTracking", { sessionId });
    }
}
