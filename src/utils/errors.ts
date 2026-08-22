import * as logger from "./logger";

export type UnhandledRejectionFilter = (err: Error) => boolean;

const puppeteerErrMsgs = [/Cannot extract value when objectId is given/, /Execution context was destroyed/];

const registeredFilters = new Set<UnhandledRejectionFilter>();

/**
 * Registers an extra predicate consulted by `shouldIgnoreUnhandledRejection`, alongside the
 * built-in Puppeteer/CDP noise filter below.
 *
 * By default, any unhandled rejection in a worker terminates the whole Testplane run - on
 * purpose, since it usually means a test is missing an `await` and continuing could produce
 * silently wrong results. But that blanket policy also catches unrelated, known-safe async
 * failures that plugins can trigger outside of any actual test - e.g. a plugin that reads a file
 * purely for its static configuration during test discovery, before any test has started, where
 * a stray async side effect in that file's import graph has nothing to do with a real test
 * missing an `await`. This lets a plugin author say "this specific kind of rejection is not a
 * sign of a real bug" without weakening the default protection for everyone else.
 *
 * A filter is only ever asked to *ignore* a rejection - registering one can never make Testplane
 * treat something as fatal that it wouldn't already. A filter that throws is treated as "did not
 * match" (fail safe) and logged, so a buggy filter can never itself become a new way to hide a
 * real error.
 *
 * @returns a function that unregisters the filter.
 */
export const registerUnhandledRejectionFilter = (filter: UnhandledRejectionFilter): (() => void) => {
    registeredFilters.add(filter);

    return () => {
        registeredFilters.delete(filter);
    };
};

export const shouldIgnoreUnhandledRejection = (err: Error | undefined): boolean => {
    if (!err) {
        return false;
    }

    if (err.name === "ProtocolError" || err.name === "TargetCloseError") {
        return true;
    }

    if (puppeteerErrMsgs.some(msg => msg.test(err.message)) && err.stack?.includes("/puppeteer-core/")) {
        return true;
    }

    for (const filter of registeredFilters) {
        try {
            if (filter(err)) {
                return true;
            }
        } catch (filterError) {
            logger.warn("A registered unhandled rejection filter threw and was ignored:", filterError);
        }
    }

    return false;
};
