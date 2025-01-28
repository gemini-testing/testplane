import { BrowserError } from "./browser.js";
import { LoadPageError } from "./load-page.js";
import { ViteRuntimeError } from "./vite-runtime.js";
import { getSelectorTextFromShadowRoot } from "../utils/index.js";
import { DOCUMENT_TITLE, VITE_SELECTORS } from "../constants.js";
const getLoadPageErrors = () => {
    if (document.title === DOCUMENT_TITLE && window.__testplane__) {
        return [];
    }
    return [LoadPageError.create()];
};
// TODO: use API from vite to get error in runtime (not existing right now)
const getViteRuntimeErrors = () => {
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
const getBrowserErrors = () => {
    return window.__testplane__.errors;
};
export const prepareError = (error) => {
    // in order to correctly pass errors through websocket
    return JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)));
};
const getErrors = (errors = []) => {
    return [errors, getViteRuntimeErrors(), getBrowserErrors()].flat().filter(Boolean).map(prepareError);
};
export const getErrorsOnPageLoad = (initError) => {
    // ignore error because in this case vite runtime error has more details
    if (initError && initError.message.includes("Failed to fetch dynamically imported module")) {
        initError = undefined;
    }
    const errors = new Array().concat(initError || [], getLoadPageErrors());
    return getErrors(errors);
};
export const getErrorsOnRunRunnable = (runnableError) => {
    return getErrors(runnableError);
};
export { BrowserError, LoadPageError, ViteRuntimeError };
//# sourceMappingURL=index.js.map