export enum DisableHoverMode {
    Always = "always",
    WhenScrollingNeeded = "when-scrolling-needed",
    Never = "never",
}

export enum BrowserSideErrorCode {
    JS = "JS",
    OUTSIDE_OF_VIEWPORT = "OUTSIDE_OF_VIEWPORT",
}

export interface BrowserSideError {
    errorCode: BrowserSideErrorCode;
    message: string;
    debugLog?: string;
}

export const isBrowserSideError = (error: unknown): error is BrowserSideError => {
    return Boolean(error && (error as BrowserSideError).errorCode && (error as BrowserSideError).message);
};
