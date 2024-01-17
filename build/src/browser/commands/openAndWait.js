"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const lodash_1 = __importDefault(require("lodash"));
const page_loader_1 = __importDefault(require("../../utils/page-loader"));
const emptyPageUrl = "about:blank";
const is = {
    image: match => match.headers?.Accept?.includes("image"),
    stylesheet: match => match.headers?.Accept?.includes("text/css"),
    font: match => lodash_1.default.isString(match.url) && [".ttf", ".woff", ".woff2"].some(ext => match.url.endsWith(ext)),
    favicon: match => lodash_1.default.isString(match.url) && match.url.endsWith("/favicon.ico"),
};
function isMatchPatterns(patterns = [], str) {
    return patterns.some(pattern => (lodash_1.default.isString(pattern) ? str.includes(pattern) : pattern.exec(str)));
}
function shouldThrowErrorDefault(match) {
    if (is.favicon(match)) {
        return false;
    }
    return is.image(match) || is.stylesheet(match) || is.font(match);
}
module.exports = (browser) => {
    const { publicAPI: session, config } = browser;
    const { openAndWaitOpts } = config;
    const isChrome = config.desiredCapabilities?.browserName === "chrome";
    const isCDP = config.automationProtocol === "devtools";
    function openAndWait(uri, { selector = [], predicate, waitNetworkIdle = openAndWaitOpts?.waitNetworkIdle, waitNetworkIdleTimeout = openAndWaitOpts?.waitNetworkIdleTimeout, failOnNetworkError = openAndWaitOpts?.failOnNetworkError, shouldThrowError = shouldThrowErrorDefault, ignoreNetworkErrorsPatterns = openAndWaitOpts?.ignoreNetworkErrorsPatterns, timeout = openAndWaitOpts?.timeout || config?.pageLoadTimeout || 0, } = {}) {
        waitNetworkIdle &&= isChrome || isCDP;
        if (!uri || uri === emptyPageUrl) {
            return new Promise(resolve => {
                session.url(uri).then(() => resolve());
            });
        }
        const selectors = typeof selector === "string" ? [selector] : selector;
        const pageLoader = new page_loader_1.default(session, {
            selectors,
            predicate,
            timeout,
            waitNetworkIdle,
            waitNetworkIdleTimeout,
        });
        let selectorsResolved = !selectors.length;
        let predicateResolved = !predicate;
        let networkResolved = !waitNetworkIdle;
        return new Promise((resolve, reject) => {
            const handleError = (err) => {
                reject(new Error(`url: ${err.message}`));
            };
            const checkLoaded = () => {
                if (selectorsResolved && predicateResolved && networkResolved) {
                    resolve();
                }
            };
            const goToPage = async () => {
                await session.url(uri);
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
        }).finally(() => pageLoader.unsubscribe());
    }
    session.addCommand("openAndWait", openAndWait);
};
//# sourceMappingURL=openAndWait.js.map