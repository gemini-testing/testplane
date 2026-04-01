import { CDPEventEmitter } from "../emitter";
import { CDPConnection } from "../connection";
import type {
    CDPExecutionContextId,
    CDPFrameId,
    CDPNetworkLoaderId,
    CDPNetworkMonotonicTime,
    CDPSessionId,
} from "../types";

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#type-ScriptIdentifier */
type PageScriptIdentifier = string;

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#type-TransitionType */
type PageTransitionType =
    | "link"
    | "typed"
    | "address_bar"
    | "auto_bookmark"
    | "auto_subframe"
    | "manual_subframe"
    | "generated"
    | "auto_toplevel"
    | "form_submit"
    | "reload"
    | "keyword"
    | "keyword_generated"
    | "other";

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#type-DialogType */
type PageDialogType = "alert" | "confirm" | "prompt" | "beforeunload";

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#type-Frame */
interface PageFrame {
    /** Frame unique identifier. */
    id: CDPFrameId;
    /** Parent frame identifier. */
    parentId?: CDPFrameId;
    /** Identifier of the loader associated with this frame. */
    loaderId: CDPNetworkLoaderId;
    /** Frame's name as specified in the tag. */
    name?: string;
    /** Frame document's URL without fragment. */
    url: string;
    /** Frame document's security origin. */
    securityOrigin: string;
    /** Frame document's mimeType as determined by the browser. */
    mimeType: string;
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#type-FrameTree */
interface PageFrameTree {
    /** Frame information for this tree item. */
    frame: PageFrame;
    /** Child frames. */
    childFrames?: PageFrameTree[];
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#type-NavigationEntry */
interface PageNavigationEntry {
    /** Unique id of the navigation history entry. */
    id: number;
    /** URL of the navigation history entry. */
    url: string;
    /** URL that the user typed in the url bar. */
    userTypedURL: string;
    /** Title of the navigation history entry. */
    title: string;
    /** Transition type. */
    transitionType: PageTransitionType;
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#type-LayoutViewport */
interface PageLayoutViewport {
    /** Horizontal offset relative to the document (CSS pixels). */
    pageX: number;
    /** Vertical offset relative to the document (CSS pixels). */
    pageY: number;
    /** Width (CSS pixels), excludes scrollbar if present. */
    clientWidth: number;
    /** Height (CSS pixels), excludes scrollbar if present. */
    clientHeight: number;
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#type-VisualViewport */
interface PageVisualViewport {
    /** Horizontal offset relative to the layout viewport (CSS pixels). */
    offsetX: number;
    /** Vertical offset relative to the layout viewport (CSS pixels). */
    offsetY: number;
    /** Horizontal offset relative to the document (CSS pixels). */
    pageX: number;
    /** Vertical offset relative to the document (CSS pixels). */
    pageY: number;
    /** Width (CSS pixels), excludes scrollbar if present. */
    clientWidth: number;
    /** Height (CSS pixels), excludes scrollbar if present. */
    clientHeight: number;
    /** Scale relative to the ideal viewport (size at width=device-width). */
    scale: number;
    /** Page zoom factor (CSS to device independent pixels ratio). */
    zoom?: number;
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#type-Viewport */
interface PageViewport {
    /** X offset in device independent pixels (dip). */
    x: number;
    /** Y offset in device independent pixels (dip). */
    y: number;
    /** Rectangle width in device independent pixels (dip). */
    width: number;
    /** Rectangle height in device independent pixels (dip). */
    height: number;
    /** Page scale factor. */
    scale: number;
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#type-AppManifestError */
interface PageAppManifestError {
    /** Error message. */
    message: string;
    /** If critical, this is a non-recoverable parse error. */
    critical: number;
    /** Error line. */
    line: number;
    /** Error column. */
    column: number;
}

interface AddScriptToEvaluateOnNewDocumentRequest {
    source: string;
}

interface AddScriptToEvaluateOnNewDocumentResponse {
    /** Identifier of the added script. */
    identifier: PageScriptIdentifier;
}

interface CaptureScreenshotRequest {
    /** Image compression format (defaults to png). */
    format?: "jpeg" | "png" | "webp";
    /** Compression quality from range [0..100] (jpeg only). */
    quality?: number;
    /** Capture the screenshot of a given region only. */
    clip?: PageViewport;
}

interface CaptureScreenshotResponse {
    /** Base64-encoded image data. (Encoded as a base64 string when passed over JSON) */
    data: string;
}

interface CreateIsolatedWorldRequest {
    /** Id of the frame in which the isolated world should be created. */
    frameId: CDPFrameId;
    /** An optional name which is reported in the Execution Context. */
    worldName?: string;
}

interface CreateIsolatedWorldResponse {
    /** Execution context of the isolated world. */
    executionContextId: CDPExecutionContextId;
}

interface GetAppManifestResponse {
    /** Manifest location. */
    url: string;
    errors: PageAppManifestError[];
    /** Manifest content. */
    data?: string;
}

interface GetFrameTreeResponse {
    /** Present frame tree structure. */
    frameTree: PageFrameTree;
}

interface GetLayoutMetricsResponse {
    /** Deprecated metrics relating to the layout viewport. Is in device pixels. Use `cssLayoutViewport` instead. */
    layoutViewport: PageLayoutViewport;
    /** Deprecated metrics relating to the visual viewport. Is in device pixels. Use `cssVisualViewport` instead. */
    visualViewport: PageVisualViewport;
    /** Deprecated size of scrollable area. Is in DP. Use `cssContentSize` instead. */
    contentSize: { x: number; y: number; width: number; height: number };
    /** Metrics relating to the layout viewport in CSS pixels. */
    cssLayoutViewport: PageLayoutViewport;
    /** Metrics relating to the visual viewport in CSS pixels. */
    cssVisualViewport: PageVisualViewport;
    /** Size of scrollable area in CSS pixels. */
    cssContentSize: { x: number; y: number; width: number; height: number };
}

interface GetNavigationHistoryResponse {
    /** Index of the current navigation history entry. */
    currentIndex: number;
    /** Array of navigation history entries. */
    entries: PageNavigationEntry[];
}

interface HandleJavaScriptDialogRequest {
    /** Whether to accept or dismiss the dialog. */
    accept: boolean;
    /** The text to enter into the dialog prompt before accepting. Used only if this is a prompt dialog. */
    promptText?: string;
}

interface NavigateRequest {
    /** URL to navigate the page to. */
    url: string;
    /** Referrer URL. */
    referrer?: string;
    /** Intended transition type. */
    transitionType?: PageTransitionType;
    /** Frame id to navigate, if not specified navigates the top level frame. */
    frameId?: CDPFrameId;
}

interface NavigateResponse {
    /** Frame id that has navigated (or failed to navigate). */
    frameId: CDPFrameId;
    /** Loader identifier. This is omitted in case of same-document navigation, as the previously committed loaderId would not change. */
    loaderId?: CDPNetworkLoaderId;
    /** User friendly error message, present if and only if navigation has failed. */
    errorText?: string;
}

interface PrintToPDFRequest {
    /** Paper orientation. Defaults to false. */
    landscape?: boolean;
    /** Display header and footer. Defaults to false. */
    displayHeaderFooter?: boolean;
    /** Print background graphics. Defaults to false. */
    printBackground?: boolean;
    /** Scale of the webpage rendering. Defaults to 1. */
    scale?: number;
    /** Paper width in inches. Defaults to 8.5 inches. */
    paperWidth?: number;
    /** Paper height in inches. Defaults to 11 inches. */
    paperHeight?: number;
    /** Top margin in inches. Defaults to 1cm (~0.4 inches). */
    marginTop?: number;
    /** Bottom margin in inches. Defaults to 1cm (~0.4 inches). */
    marginBottom?: number;
    /** Left margin in inches. Defaults to 1cm (~0.4 inches). */
    marginLeft?: number;
    /** Right margin in inches. Defaults to 1cm (~0.4 inches). */
    marginRight?: number;
    /** Paper ranges to print, one based, e.g., '1-5, 8, 11-13'. Pages are printed in the document order, not in the order specified, and no more than once. Defaults to empty string, which implies the entire document is printed. */
    pageRanges?: string;
    /** HTML template for the print header. Should be valid HTML markup. */
    headerTemplate?: string;
    /** HTML template for the print footer. Should use the same format as the headerTemplate. */
    footerTemplate?: string;
    /** Whether or not to prefer page size as defined by css. Defaults to false, in which case the content will be scaled to fit the paper size. */
    preferCSSPageSize?: boolean;
}

interface PrintToPDFResponse {
    /** Base64-encoded pdf data. (Encoded as a base64 string when passed over JSON) */
    data: string;
}

interface ReloadRequest {
    /** If true, browser cache is ignored (as if the user pressed Shift+refresh). */
    ignoreCache?: boolean;
    /** If set, the script will be injected into all frames of the inspected page after reload. Argument will be ignored if reloading dataURL origin. */
    scriptToEvaluateOnLoad?: string;
}

interface SetDocumentContentRequest {
    /** Frame id to set HTML for. */
    frameId: CDPFrameId;
    /** HTML content to set. */
    html: string;
}

export interface PageEvents {
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#event-domContentEventFired */
    domContentEventFired: {
        timestamp: CDPNetworkMonotonicTime;
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#event-fileChooserOpened */
    fileChooserOpened: {
        /** Input mode. */
        mode: "selectSingle" | "selectMultiple";
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#event-frameAttached */
    frameAttached: {
        /** Id of the frame that has been attached. */
        frameId: CDPFrameId;
        /** Parent frame identifier. */
        parentFrameId: CDPFrameId;
        /** JavaScript stack trace of when frame was attached, only set if frame initiated from script. */
        stack?: Record<string, unknown>;
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#event-frameDetached */
    frameDetached: {
        /** Id of the frame that has been detached. */
        frameId: CDPFrameId;
        reason: "remove" | "swap";
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#event-frameNavigated */
    frameNavigated: {
        /** Frame object. */
        frame: PageFrame;
        type: PageTransitionType;
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#event-interstitialHidden */
    interstitialHidden: Record<string, never>;
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#event-interstitialShown */
    interstitialShown: Record<string, never>;
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#event-javascriptDialogClosed */
    javascriptDialogClosed: {
        /** Whether dialog was confirmed. */
        result: boolean;
        /** User input in case of prompt. */
        userInput: string;
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#event-javascriptDialogOpening */
    javascriptDialogOpening: {
        /** Frame url. */
        url: string;
        /** Message that will be displayed by the dialog. */
        message: string;
        /** Dialog type. */
        type: PageDialogType;
        /** True iff browser is capable showing or acting on the given dialog. When browser has no dialog handler for given target, calling alert while Page domain is engaged will stall the page execution. Execution can be resumed via calling Page.handleJavaScriptDialog. */
        hasBrowserHandler: boolean;
        /** Default dialog prompt. */
        defaultPrompt?: string;
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#event-lifecycleEvent */
    lifecycleEvent: {
        /** Id of the frame. */
        frameId: CDPFrameId;
        /** Loader identifier. Empty string if the request is fetched from worker. */
        loaderId: CDPNetworkLoaderId;
        name: string;
        timestamp: CDPNetworkMonotonicTime;
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#event-loadEventFired */
    loadEventFired: {
        timestamp: CDPNetworkMonotonicTime;
    };
    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#event-windowOpen */
    windowOpen: {
        /** The URL for the new window. */
        url: string;
        /** Window name. */
        windowName: string;
        /** An array of enabled window features. */
        windowFeatures: string[];
        /** Whether or not it was triggered by user gesture. */
        userGesture: boolean;
    };
}

/** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/ */
export class CDPPage extends CDPEventEmitter<PageEvents> {
    private readonly _connection: CDPConnection;

    public constructor(connection: CDPConnection) {
        super();

        this._connection = connection;
    }

    /**
     * @param sessionId result of "Target.attachToTarget"
     * @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#method-enable
     */
    async enable(sessionId: CDPSessionId): Promise<void> {
        return this._connection.request("Page.enable", { sessionId });
    }

    /**
     * @param sessionId result of "Target.attachToTarget"
     * @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#method-disable
     */
    async disable(sessionId: CDPSessionId): Promise<void> {
        return this._connection.request("Page.disable", { sessionId });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#method-addScriptToEvaluateOnNewDocument */
    async addScriptToEvaluateOnNewDocument(
        sessionId: CDPSessionId,
        params: AddScriptToEvaluateOnNewDocumentRequest,
    ): Promise<AddScriptToEvaluateOnNewDocumentResponse> {
        return this._connection.request("Page.addScriptToEvaluateOnNewDocument", { sessionId, params });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#method-removeScriptToEvaluateOnNewDocument */
    async removeScriptToEvaluateOnNewDocument(
        sessionId: CDPSessionId,
        identifier: PageScriptIdentifier,
    ): Promise<void> {
        return this._connection.request("Page.removeScriptToEvaluateOnNewDocument", {
            sessionId,
            params: { identifier },
        });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#method-bringToFront */
    async bringToFront(sessionId: CDPSessionId): Promise<void> {
        return this._connection.request("Page.bringToFront", { sessionId });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#method-captureScreenshot */
    async captureScreenshot(
        sessionId: CDPSessionId,
        params?: CaptureScreenshotRequest,
    ): Promise<CaptureScreenshotResponse> {
        return this._connection.request("Page.captureScreenshot", { sessionId, params });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#method-close */
    async close(sessionId: CDPSessionId): Promise<void> {
        return this._connection.request("Page.close", { sessionId });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#method-createIsolatedWorld */
    async createIsolatedWorld(
        sessionId: CDPSessionId,
        params: CreateIsolatedWorldRequest,
    ): Promise<CreateIsolatedWorldResponse> {
        return this._connection.request("Page.createIsolatedWorld", { sessionId, params });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#method-getAppManifest */
    async getAppManifest(sessionId: CDPSessionId): Promise<GetAppManifestResponse> {
        return this._connection.request("Page.getAppManifest", { sessionId });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#method-getFrameTree */
    async getFrameTree(sessionId: CDPSessionId): Promise<GetFrameTreeResponse> {
        return this._connection.request("Page.getFrameTree", { sessionId });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#method-getLayoutMetrics */
    async getLayoutMetrics(sessionId: CDPSessionId): Promise<GetLayoutMetricsResponse> {
        return this._connection.request("Page.getLayoutMetrics", { sessionId });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#method-getNavigationHistory */
    async getNavigationHistory(sessionId: CDPSessionId): Promise<GetNavigationHistoryResponse> {
        return this._connection.request("Page.getNavigationHistory", { sessionId });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#method-resetNavigationHistory */
    async resetNavigationHistory(sessionId: CDPSessionId): Promise<void> {
        return this._connection.request("Page.resetNavigationHistory", { sessionId });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#method-handleJavaScriptDialog */
    async handleJavaScriptDialog(sessionId: CDPSessionId, params: HandleJavaScriptDialogRequest): Promise<void> {
        return this._connection.request("Page.handleJavaScriptDialog", { sessionId, params });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#method-navigate */
    async navigate(sessionId: CDPSessionId, params: NavigateRequest): Promise<NavigateResponse> {
        return this._connection.request("Page.navigate", { sessionId, params });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#method-navigateToHistoryEntry */
    async navigateToHistoryEntry(sessionId: CDPSessionId, entryId: number): Promise<void> {
        return this._connection.request("Page.navigateToHistoryEntry", { sessionId, params: { entryId } });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#method-printToPDF */
    async printToPDF(sessionId: CDPSessionId, params?: PrintToPDFRequest): Promise<PrintToPDFResponse> {
        return this._connection.request("Page.printToPDF", { sessionId, params });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#method-reload */
    async reload(sessionId: CDPSessionId, params?: ReloadRequest): Promise<void> {
        return this._connection.request("Page.reload", { sessionId, params });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#method-setBypassCSP */
    async setBypassCSP(sessionId: CDPSessionId, enabled: boolean): Promise<void> {
        return this._connection.request("Page.setBypassCSP", { sessionId, params: { enabled } });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#method-setDocumentContent */
    async setDocumentContent(sessionId: CDPSessionId, params: SetDocumentContentRequest): Promise<void> {
        return this._connection.request("Page.setDocumentContent", { sessionId, params });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#method-setInterceptFileChooserDialog */
    async setInterceptFileChooserDialog(sessionId: CDPSessionId, enabled: boolean): Promise<void> {
        return this._connection.request("Page.setInterceptFileChooserDialog", { sessionId, params: { enabled } });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#method-setLifecycleEventsEnabled */
    async setLifecycleEventsEnabled(sessionId: CDPSessionId, enabled: boolean): Promise<void> {
        return this._connection.request("Page.setLifecycleEventsEnabled", { sessionId, params: { enabled } });
    }

    /** @link https://chromedevtools.github.io/devtools-protocol/1-3/Page/#method-stopLoading */
    async stopLoading(sessionId: CDPSessionId): Promise<void> {
        return this._connection.request("Page.stopLoading", { sessionId });
    }
}
