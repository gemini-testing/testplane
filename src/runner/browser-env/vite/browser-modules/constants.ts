export const DOCUMENT_TITLE = "Testplane Browser Test";
export const VITE_OVERLAY_SELECTOR = "vite-error-overlay";

export const VITE_SELECTORS = {
    overlay: "vite-error-overlay",
    overlayMessage: ".message",
    overlayStack: ".stack",
    overlayFile: ".file",
    overlayFrame: ".frame",
    overlayTip: ".tip",
};

export const BROWSER_EVENT_PREFIX = "browser";
export const WORKER_EVENT_PREFIX = "worker";

// TODO: use from nodejs code after migrate to esm
export const SOCKET_MAX_TIMEOUT = 2147483647;
export const SOCKET_TIMED_OUT_ERROR = "operation has timed out";

export const MAX_ARGS_LENGTH = 50;

// used from - https://github.com/jestjs/jest/blob/726ca20752e38c18e20aa21740cec7aba7891946/packages/pretty-format/src/plugins/AsymmetricMatcher.ts#L11-L14
export const ASYMMETRIC_MATCHER =
    typeof Symbol === "function" && Symbol.for ? Symbol.for("jest.asymmetricMatcher") : 0x13_57_a5;
