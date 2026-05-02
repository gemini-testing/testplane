import _ from "lodash";
import type { Matches } from "@testplane/webdriverio";
import type { Browser } from "../types";
import type { BrowserConfig } from "../../config/browser-config";

interface WaitOpts {
    selector?: string | string[];
    predicate?: () => boolean;
    waitNetworkIdle?: boolean;
    waitNetworkIdleTimeout?: number;
    failOnNetworkError?: boolean;
    shouldThrowError?: (match: Matches) => boolean;
    ignoreNetworkErrorsPatterns?: Array<RegExp | string>;
    timeout?: number;
}

const emptyPageUrl = "about:blank";

const is: Record<string, (match: Matches) => boolean> = {
    image: match => match.headers?.Accept?.includes("image"),
    stylesheet: match => match.headers?.Accept?.includes("text/css"),
    font: match => _.isString(match.url) && [".ttf", ".woff", ".woff2"].some(ext => match.url.endsWith(ext)),
    favicon: match => _.isString(match.url) && match.url.endsWith("/favicon.ico"),
};

const makeOpenAndWaitCommand = (config: BrowserConfig, session: WebdriverIO.Browser) =>
    async function openAndWait(
        this: WebdriverIO.Browser,
        uri: string,
        {
            selector = [],
            predicate,
            waitNetworkIdle = config.openAndWaitOpts?.waitNetworkIdle,
            waitNetworkIdleTimeout = config.openAndWaitOpts?.waitNetworkIdleTimeout,
            failOnNetworkError = config.openAndWaitOpts?.failOnNetworkError,
            shouldThrowError = shouldThrowErrorDefault,
            ignoreNetworkErrorsPatterns = config.openAndWaitOpts?.ignoreNetworkErrorsPatterns,
            timeout = config.openAndWaitOpts?.timeout || config?.pageLoadTimeout || 0,
        }: WaitOpts = {},
    ): Promise<string | void> {
        const PageLoader = await import("../../utils/page-loader").then(m => m.default);
        const isChrome = config.desiredCapabilities?.browserName === "chrome";
        const isCDP = config.automationProtocol === "devtools";

        waitNetworkIdle &&= isChrome || isCDP;

        const originalPageLoadTimeout = config.pageLoadTimeout;
        const shouldUpdateTimeout = timeout && timeout !== originalPageLoadTimeout;

        const setPageLoadTimeout = async (value: number | null): Promise<void> => {
            if (!value) {
                return;
            }
            try {
                await session.setTimeout({ pageLoad: value });
            } catch {
                /* */
            }
        };

        const restorePageLoadTimeout = (): void => {
            if (shouldUpdateTimeout && originalPageLoadTimeout) {
                // No await because session might be stuck on url() command
                setPageLoadTimeout(originalPageLoadTimeout).catch(() => {});
            }
        };

        if (!uri || uri === emptyPageUrl) {
            return new Promise(resolve => {
                session.url(uri).then(() => resolve());
            });
        }

        const selectors = typeof selector === "string" ? [selector] : selector;

        const pageLoader = new PageLoader(session, {
            selectors,
            predicate,
            timeout,
            waitNetworkIdle,
            waitNetworkIdleTimeout,
        });

        let selectorsResolved = !selectors.length;
        let predicateResolved = !predicate;
        let networkResolved = !waitNetworkIdle;

        if (shouldUpdateTimeout) {
            await setPageLoadTimeout(timeout);
        }

        const loadPromise = new Promise<void>((resolve, reject) => {
            const handleError = (err: Error): void => {
                reject(new Error(`url: ${err.message}`));
            };

            const checkLoaded = (): void => {
                if (selectorsResolved && predicateResolved && networkResolved) {
                    resolve();
                }
            };

            const goToPage = async (): Promise<void> => {
                const promises: Promise<unknown>[] = [];

                promises.push(
                    session.url(uri, { timeout, _noFallbackOnCancel: true }).finally(() => {
                        restorePageLoadTimeout();
                    }),
                );

                let hardTimeoutId: NodeJS.Timeout | undefined;

                /* BiDi doesn't respect pageLoadTimeout, so we need to set a hard timeout and cancel previous navigation
                 * by navigating to about:blank */
                if (session.isBidi) {
                    promises.push(
                        new Promise<never>((_, reject) => {
                            hardTimeoutId = setTimeout(async () => {
                                await session.url(emptyPageUrl);

                                reject(
                                    new Error(
                                        `openAndWait timed out after ${timeout}ms while trying to navigate to ${uri}`,
                                    ),
                                );
                            }, timeout);
                        }),
                    );
                }

                try {
                    await Promise.race(promises);
                } finally {
                    clearTimeout(hardTimeoutId);
                }
            };

            pageLoader.on("pageLoadError", handleError);
            pageLoader.on("selectorsError", handleError);
            pageLoader.on("predicateError", handleError);
            pageLoader.on("networkError", match => {
                if (!failOnNetworkError) {
                    return;
                }

                const shouldIgnore = isMatchPatterns(ignoreNetworkErrorsPatterns, match.url);

                if (!shouldIgnore && shouldThrowError(match)) {
                    reject(new Error(`url: couldn't get content from ${match.url}: ${match.statusCode}`));
                }
            });
            pageLoader.on("selectorsExist", () => {
                selectorsResolved = true;
                checkLoaded();
            });

            pageLoader.on("predicateResolved", () => {
                predicateResolved = true;
                checkLoaded();
            });

            pageLoader.on("networkResolved", () => {
                networkResolved = true;
                checkLoaded();
            });

            pageLoader.load(goToPage).then(checkLoaded);
        });

        return loadPromise.finally(() => pageLoader.unsubscribe());
    };

export type OpenAndWaitCommand = ReturnType<typeof makeOpenAndWaitCommand>;

export default (browser: Browser): void => {
    const { publicAPI: session, config } = browser;

    session.addCommand("openAndWait", makeOpenAndWaitCommand(config, session));
};

function isMatchPatterns(patterns: Array<RegExp | string> = [], str: string): boolean {
    return patterns.some(pattern => (_.isString(pattern) ? str.includes(pattern) : pattern.exec(str)));
}

function shouldThrowErrorDefault(match: Matches): boolean {
    if (is.favicon(match)) {
        return false;
    }

    return is.image(match) || is.stylesheet(match) || is.font(match);
}
