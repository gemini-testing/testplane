import { BrowserError } from "./browser.js";
import { LoadPageError } from "./load-page.js";
import { ViteRuntimeError } from "./vite-runtime.js";
import { getSelectorTextFromShadowRoot } from "../utils/index.js";
import { DOCUMENT_TITLE, VITE_SELECTORS } from "../constants.js";

export type ErrorOnRunRunnable = ViteRuntimeError | BrowserError | Error;
export type ErrorOnPageLoad = LoadPageError | ErrorOnRunRunnable;
export type ViteError = ErrorOnPageLoad | ErrorOnRunRunnable;

const getLoadPageErrors = (): LoadPageError[] => {
    if (document.title === DOCUMENT_TITLE && window.__testplane__) {
        return [];
    }

    return [LoadPageError.create()];
};

// TODO: use API from vite to get error in runtime (not existing right now)
const getViteRuntimeErrors = (): ViteRuntimeError[] => {
    const viteErrorElem = document.querySelector(VITE_SELECTORS.overlay);

    if (!viteErrorElem || !viteErrorElem.shadowRoot) {
        return [];
    }

    const shadowRoot = viteErrorElem.shadowRoot;

    const message = getSelectorTextFromShadowRoot(VITE_SELECTORS.overlayMessage, shadowRoot);
    const stack = getSelectorTextFromShadowRoot(VITE_SELECTORS.overlayStack, shadowRoot);
    const file = getSelectorTextFromShadowRoot(VITE_SELECTORS.overlayFile, shadowRoot);
    const frame = getSelectorTextFromShadowRoot(VITE_SELECTORS.overlayFrame, shadowRoot);
    const tip = getSelectorTextFromShadowRoot(VITE_SELECTORS.overlayTip, shadowRoot);

    return [ViteRuntimeError.create({ message, stack, file, frame, tip })];
};

const getBrowserErrors = (): BrowserError[] => {
    return window.__testplane__.errors;
};

export const prepareError = (error: Error): Error => {
    // in order to correctly pass errors through websocket
    return JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)));
};

const getErrors = (errors: ViteError | ViteError[] = []): ViteError[] => {
    return [errors, getViteRuntimeErrors(), getBrowserErrors()].flat().filter(Boolean).map(prepareError);
};

export const getErrorsOnPageLoad = (initError?: Error): ErrorOnPageLoad[] => {
    const errors = new Array<ViteError>().concat(initError || [], getLoadPageErrors());

    return getErrors(errors);
};

export const getErrorsOnRunRunnable = (runnableError?: Error): ViteError[] => {
    return getErrors(runnableError);
};

export { BrowserError, LoadPageError, ViteRuntimeError };
