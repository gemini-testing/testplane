import type { CDP } from "..";
import type { PageEvents } from "../domains/page";
import type { CDPSessionId } from "../types";
import { enableClickCommandGuard, type ClickCommandGuard } from "./click-command-guard";

export interface ClickNavigationGuard {
    onBeforeUnloadPause: () => void;
    onBfcacheRestorePause: () => boolean;
    completeBfcacheRestore: () => void;
    dispose: () => void;
}

interface CreateClickNavigationGuardOptions {
    browser: WebdriverIO.Browser;
    cdp: CDP;
    cdpSessionId: CDPSessionId;
    pageLoadStrategy: "normal" | "eager";
    pageLoadTimeout: number | null;
    waitForPageSwitch: () => Promise<void>;
}

interface Deferred {
    promise: Promise<void>;
    resolve: () => void;
}

type NavigationState = "waitingForCommit" | "committed";

const createDeferred = (): Deferred => {
    let resolve!: () => void;
    const promise = new Promise<void>(done => {
        resolve = done;
    });

    return { promise, resolve };
};

/**
 * Tracks click-triggered top-frame navigation using stable CDP 1.3 signals.
 *
 * Selectivity pauses the renderer in beforeunload to preserve coverage. ChromeDriver can return from an element click
 * while that pause is active, before its own navigation wait sees the new document. The guard keeps the click pending
 * through the coverage page-switch queue, navigation commit, and the configured page-load milestone.
 */
class ClickNavigationTracker implements ClickCommandGuard {
    private _navigationState: NavigationState | null = null;
    private _navigationWait: Deferred | null = null;
    private _navigationGeneration: object = {};
    private _rendererRoundtripWait: Deferred | null = null;
    private _openJavaScriptDialogType: PageEvents["javascriptDialogOpening"]["type"] | null = null;
    private _isBfcacheRestoreObserved = false;
    private _activeClick: object | null = null;

    constructor(private readonly _options: CreateClickNavigationGuardOptions) {}

    startClick = (): void => {
        this._isBfcacheRestoreObserved = false;
        this._clearNavigation();
        this._activeClick = {};
    };

    waitForNavigationCompletion = async (): Promise<void> => {
        try {
            await this._options.waitForPageSwitch();

            if (!this._activeClick) {
                return;
            }

            await this._waitForRendererRoundtrip();

            if (!this._activeClick) {
                return;
            }

            await this._waitForNavigation();
            await this._options.waitForPageSwitch();
        } finally {
            this._activeClick = null;
            this._isBfcacheRestoreObserved = false;
        }
    };

    cancelClick = (): void => {
        this._activeClick = null;
        this._isBfcacheRestoreObserved = false;
        this._rendererRoundtripWait?.resolve();
        this._clearNavigation();
    };

    onBeforeUnloadPause = (): void => {
        this._isBfcacheRestoreObserved = false;
        this._markNavigationIntent();
    };

    onBfcacheRestorePause = (): boolean => {
        if (!this._activeClick) {
            return false;
        }

        this._isBfcacheRestoreObserved = true;

        return true;
    };

    completeBfcacheRestore = (): void => {
        this._clearNavigation();
    };

    addListeners = (): void => {
        const { cdp } = this._options;

        cdp.page.on("frameNavigated", this._onFrameNavigated);
        cdp.page.on("domContentEventFired", this._onDomContentEventFired);
        cdp.page.on("loadEventFired", this._onLoadEventFired);
        cdp.page.on("javascriptDialogOpening", this._onJavaScriptDialogOpening);
        cdp.page.on("javascriptDialogClosed", this._onJavaScriptDialogClosed);
    };

    removeListeners = (): void => {
        const { cdp } = this._options;

        cdp.page.off("frameNavigated", this._onFrameNavigated);
        cdp.page.off("domContentEventFired", this._onDomContentEventFired);
        cdp.page.off("loadEventFired", this._onLoadEventFired);
        cdp.page.off("javascriptDialogOpening", this._onJavaScriptDialogOpening);
        cdp.page.off("javascriptDialogClosed", this._onJavaScriptDialogClosed);
    };

    private _clearNavigation = (): void => {
        this._navigationGeneration = {};
        this._navigationWait?.resolve();
        this._navigationWait = null;
        this._navigationState = null;
    };

    private _markNavigationIntent = (): void => {
        if (!this._activeClick || this._navigationState) {
            return;
        }

        this._navigationState = "waitingForCommit";
        this._navigationWait = createDeferred();
    };

    private _waitForNavigation = async (): Promise<void> => {
        if (this._openJavaScriptDialogType === "beforeunload") {
            // Return control so the caller can accept or dismiss the prompt. Automatically accepted prompts close before
            // this check and remain guarded until commit and load.
            this._clearNavigation();

            return;
        }

        const navigationWait = this._navigationWait;
        const pageLoadTimeout = this._options.pageLoadTimeout;

        if (!navigationWait || !pageLoadTimeout) {
            await navigationWait?.promise;

            return;
        }

        let timeoutId: NodeJS.Timeout | null = null;

        try {
            await Promise.race([
                navigationWait.promise,
                new Promise<never>((_, reject) => {
                    timeoutId = setTimeout(() => {
                        reject(
                            new Error("Selectivity: timed out waiting for a click-triggered navigation to complete"),
                        );
                    }, pageLoadTimeout);
                }),
            ]);
        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            this._clearNavigation();
        }
    };

    private _waitForRendererRoundtrip = async (): Promise<void> => {
        if (this._openJavaScriptDialogType !== null) {
            return;
        }

        const rendererRoundtripWait = createDeferred();
        const activeClick = this._activeClick;
        const navigationGeneration = this._navigationGeneration;

        this._rendererRoundtripWait = rendererRoundtripWait;

        try {
            await Promise.race([
                this._options.cdp.runtime
                    .evaluate(this._options.cdpSessionId, { expression: "1", returnByValue: true })
                    .then(() => undefined)
                    .catch(() => {
                        // The context can disappear after navigation starts. Ignore stale failures delivered after this
                        // click or navigation generation already completed.
                        if (this._activeClick === activeClick && this._navigationGeneration === navigationGeneration) {
                            this._markNavigationIntent();
                        }
                    }),
                rendererRoundtripWait.promise,
            ]);
        } finally {
            if (this._rendererRoundtripWait === rendererRoundtripWait) {
                this._rendererRoundtripWait = null;
            }
        }
    };

    private _onFrameNavigated = ({ frame }: PageEvents["frameNavigated"], eventCdpSessionId?: CDPSessionId): void => {
        if (eventCdpSessionId !== this._options.cdpSessionId || frame.parentId || !this._activeClick) {
            return;
        }

        if (this._isBfcacheRestoreObserved) {
            // The pageshow.persisted pause already guards the restore through coverage flush and Debugger.resume.
            this._isBfcacheRestoreObserved = false;
            this._clearNavigation();

            return;
        }

        this._markNavigationIntent();

        if (this._navigationState === "waitingForCommit") {
            this._navigationState = "committed";
        }
    };

    private _onDomContentEventFired = (_params: unknown, eventCdpSessionId?: CDPSessionId): void => {
        if (
            this._options.pageLoadStrategy === "eager" &&
            eventCdpSessionId === this._options.cdpSessionId &&
            this._navigationState === "committed"
        ) {
            this._clearNavigation();
        }
    };

    private _onLoadEventFired = (_params: unknown, eventCdpSessionId?: CDPSessionId): void => {
        if (
            this._options.pageLoadStrategy === "normal" &&
            eventCdpSessionId === this._options.cdpSessionId &&
            this._navigationState === "committed"
        ) {
            this._clearNavigation();
        }
    };

    private _onJavaScriptDialogOpening = (
        { type }: PageEvents["javascriptDialogOpening"],
        eventCdpSessionId?: CDPSessionId,
    ): void => {
        if (eventCdpSessionId !== this._options.cdpSessionId) {
            return;
        }

        this._openJavaScriptDialogType = type;
        this._rendererRoundtripWait?.resolve();

        if (type !== "beforeunload") {
            this._clearNavigation();
        }
    };

    private _onJavaScriptDialogClosed = (
        { result }: PageEvents["javascriptDialogClosed"],
        eventCdpSessionId?: CDPSessionId,
    ): void => {
        if (eventCdpSessionId !== this._options.cdpSessionId) {
            return;
        }

        const dialogType = this._openJavaScriptDialogType;

        this._openJavaScriptDialogType = null;

        if (dialogType === "beforeunload" && !result) {
            this._clearNavigation();
        }
    };
}

export const createClickNavigationGuard = (options: CreateClickNavigationGuardOptions): ClickNavigationGuard => {
    const tracker = new ClickNavigationTracker(options);
    let disableClickCommandGuard: () => void;

    try {
        tracker.addListeners();
        disableClickCommandGuard = enableClickCommandGuard(options.browser, tracker);
    } catch (err) {
        tracker.removeListeners();
        throw err;
    }

    return {
        onBeforeUnloadPause: tracker.onBeforeUnloadPause,
        onBfcacheRestorePause: tracker.onBfcacheRestorePause,
        completeBfcacheRestore: tracker.completeBfcacheRestore,
        dispose: (): void => {
            disableClickCommandGuard();
            tracker.removeListeners();
        },
    };
};
