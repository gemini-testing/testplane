import { BIDIEmitter } from "../emitter";
import type { BIDIConnection } from "../connection";
import type {
    BiDiBrowsingContextActivateParameters,
    BiDiBrowsingContextActivateResult,
    BiDiBrowsingContextCaptureScreenshotParameters,
    BiDiBrowsingContextCaptureScreenshotResult,
    BiDiBrowsingContextCloseParameters,
    BiDiBrowsingContextCloseResult,
    BiDiBrowsingContextCreateParameters,
    BiDiBrowsingContextCreateResult,
    BiDiBrowsingContextGetTreeParameters,
    BiDiBrowsingContextGetTreeResult,
    BiDiBrowsingContextDownloadEndParams,
    BiDiBrowsingContextDownloadWillBeginParams,
    BiDiBrowsingContextHandleUserPromptParameters,
    BiDiBrowsingContextHandleUserPromptResult,
    BiDiBrowsingContextHistoryUpdatedParameters,
    BiDiBrowsingContextInfo,
    BiDiBrowsingContextLocateNodesParameters,
    BiDiBrowsingContextLocateNodesResult,
    BiDiBrowsingContextNavigateParameters,
    BiDiBrowsingContextNavigateResult,
    BiDiBrowsingContextNavigationInfo,
    BiDiBrowsingContextPrintParameters,
    BiDiBrowsingContextPrintResult,
    BiDiBrowsingContextReloadParameters,
    BiDiBrowsingContextReloadResult,
    BiDiBrowsingContextSetBypassCSPParameters,
    BiDiBrowsingContextSetBypassCSPResult,
    BiDiBrowsingContextSetViewportParameters,
    BiDiBrowsingContextSetViewportResult,
    BiDiBrowsingContextStartScreencastParameters,
    BiDiBrowsingContextStartScreencastResult,
    BiDiBrowsingContextStopScreencastParameters,
    BiDiBrowsingContextStopScreencastResult,
    BiDiBrowsingContextTraverseHistoryParameters,
    BiDiBrowsingContextTraverseHistoryResult,
    BiDiBrowsingContextUserPromptClosedParameters,
    BiDiBrowsingContextUserPromptOpenedParameters,
} from "../types";

export interface BiDiBrowsingContextEvents {
    contextCreated: BiDiBrowsingContextInfo;
    contextDestroyed: BiDiBrowsingContextInfo;
    navigationStarted: BiDiBrowsingContextNavigationInfo;
    fragmentNavigated: BiDiBrowsingContextNavigationInfo;
    historyUpdated: BiDiBrowsingContextHistoryUpdatedParameters;
    domContentLoaded: BiDiBrowsingContextNavigationInfo;
    load: BiDiBrowsingContextNavigationInfo;
    downloadWillBegin: BiDiBrowsingContextDownloadWillBeginParams;
    downloadEnd: BiDiBrowsingContextDownloadEndParams;
    navigationAborted: BiDiBrowsingContextNavigationInfo;
    navigationCommitted: BiDiBrowsingContextNavigationInfo;
    navigationFailed: BiDiBrowsingContextNavigationInfo;
    userPromptClosed: BiDiBrowsingContextUserPromptClosedParameters;
    userPromptOpened: BiDiBrowsingContextUserPromptOpenedParameters;
}

/** @link https://www.w3.org/TR/webdriver-bidi/#module-browsingContext */
export class BiDiBrowsingContext extends BIDIEmitter<BiDiBrowsingContextEvents> {
    private readonly _connection: BIDIConnection;

    public constructor(connection: BIDIConnection) {
        super();

        this._connection = connection;
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-browsingContext-activate
     */
    async activate(params: BiDiBrowsingContextActivateParameters): Promise<BiDiBrowsingContextActivateResult> {
        return this._connection.request("browsingContext.activate", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-browsingContext-captureScreenshot
     */
    async captureScreenshot(
        params: BiDiBrowsingContextCaptureScreenshotParameters,
    ): Promise<BiDiBrowsingContextCaptureScreenshotResult> {
        return this._connection.request("browsingContext.captureScreenshot", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-browsingContext-close
     */
    async close(params: BiDiBrowsingContextCloseParameters): Promise<BiDiBrowsingContextCloseResult> {
        return this._connection.request("browsingContext.close", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-browsingContext-create
     */
    async create(params: BiDiBrowsingContextCreateParameters): Promise<BiDiBrowsingContextCreateResult> {
        return this._connection.request("browsingContext.create", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-browsingContext-getTree
     */
    async getTree(params: BiDiBrowsingContextGetTreeParameters): Promise<BiDiBrowsingContextGetTreeResult> {
        return this._connection.request("browsingContext.getTree", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-browsingContext-handleUserPrompt
     */
    async handleUserPrompt(
        params: BiDiBrowsingContextHandleUserPromptParameters,
    ): Promise<BiDiBrowsingContextHandleUserPromptResult> {
        return this._connection.request("browsingContext.handleUserPrompt", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-browsingContext-locateNodes
     */
    async locateNodes(params: BiDiBrowsingContextLocateNodesParameters): Promise<BiDiBrowsingContextLocateNodesResult> {
        return this._connection.request("browsingContext.locateNodes", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-browsingContext-navigate
     */
    async navigate(params: BiDiBrowsingContextNavigateParameters): Promise<BiDiBrowsingContextNavigateResult> {
        return this._connection.request("browsingContext.navigate", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-browsingContext-print
     */
    async print(params: BiDiBrowsingContextPrintParameters): Promise<BiDiBrowsingContextPrintResult> {
        return this._connection.request("browsingContext.print", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-browsingContext-reload
     */
    async reload(params: BiDiBrowsingContextReloadParameters): Promise<BiDiBrowsingContextReloadResult> {
        return this._connection.request("browsingContext.reload", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-browsingContext-setBypassCSP
     */
    async setBypassCSP(
        params: BiDiBrowsingContextSetBypassCSPParameters,
    ): Promise<BiDiBrowsingContextSetBypassCSPResult> {
        return this._connection.request("browsingContext.setBypassCSP", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-browsingContext-setViewport
     */
    async setViewport(params: BiDiBrowsingContextSetViewportParameters): Promise<BiDiBrowsingContextSetViewportResult> {
        return this._connection.request("browsingContext.setViewport", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-browsingContext-startScreencast
     */
    async startScreencast(
        params: BiDiBrowsingContextStartScreencastParameters,
    ): Promise<BiDiBrowsingContextStartScreencastResult> {
        return this._connection.request("browsingContext.startScreencast", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-browsingContext-stopScreencast
     */
    async stopScreencast(
        params: BiDiBrowsingContextStopScreencastParameters,
    ): Promise<BiDiBrowsingContextStopScreencastResult> {
        return this._connection.request("browsingContext.stopScreencast", params);
    }

    /**
     * @link https://www.w3.org/TR/webdriver-bidi/#command-browsingContext-traverseHistory
     */
    async traverseHistory(
        params: BiDiBrowsingContextTraverseHistoryParameters,
    ): Promise<BiDiBrowsingContextTraverseHistoryResult> {
        return this._connection.request("browsingContext.traverseHistory", params);
    }
}
