import { expect } from "expect";
import { ASYMMETRIC_MATCHER } from "./constants.js";
import { BrowserEventNames } from "./types.js";
export const initExpect = () => {
    const mockedMatchers = mockMatchers(window.__testplane__.expectMatchers);
    expect.extend(mockedMatchers);
    return expect;
};
function mockMatchers(matcherNames) {
    return matcherNames.reduce((acc, matcherName) => {
        acc[matcherName] = mockMatcher(matcherName);
        return acc;
    }, {});
}
function mockMatcher(matcherName) {
    const mockMatcherFn = async function (context, ...args) {
        if (typeof args[0] === "object" &&
            "$$typeof" in args[0] &&
            args[0].$$typeof === ASYMMETRIC_MATCHER &&
            args[0].asymmetricMatch) {
            args[0] = {
                $$typeof: args[0].toString(),
                sample: args[0].sample,
                inverse: args[0].inverse,
            };
        }
        const matcherPayload = {
            name: matcherName,
            scope: this,
            args,
        };
        const isContextObject = typeof context === "object";
        /**
         * Check if context is a WebdriverIO.Element
         */
        if (isContextObject && "elementId" in context && typeof context.elementId === "string") {
            matcherPayload.element = context;
        }
        /**
         * Check if context is ChainablePromiseElement
         */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (isContextObject && "then" in context && typeof context.selector === "object") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            matcherPayload.element = await context;
        }
        /**
         * Check if context is an `Element` and transform it into a WebdriverIO.Element
         */
        if (context instanceof Element) {
            matcherPayload.element = await window.browser.$(context);
        }
        else if (isContextObject && !("sessionId" in context)) {
            /**
             * check if context is an object or promise and resolve it
             * but not pass through the browser object
             */
            matcherPayload.context = context;
            if ("then" in context) {
                matcherPayload.context = await context;
            }
        }
        else if (!isContextObject) {
            /**
             * if context is not an object or promise, pass it through
             */
            matcherPayload.context = context;
        }
        /**
         * Avoid serialization issues when sending over the element. If we create
         * an element from an existing HTMLElement, it might have custom properties
         * attached to it that can't be serialized.
         */
        if (matcherPayload.element && typeof matcherPayload.element.selector !== "string") {
            matcherPayload.element.selector = "";
        }
        const { socket, config } = window.__testplane__;
        // TODO: remove type casting after https://github.com/socketio/socket.io/issues/4925
        const [{ pass, message }] = (await socket
            .timeout(config.httpTimeout)
            .emitWithAck(BrowserEventNames.runExpectMatcher, matcherPayload));
        return { pass, message: () => message };
    };
    return mockMatcherFn;
}
//# sourceMappingURL=expect.js.map