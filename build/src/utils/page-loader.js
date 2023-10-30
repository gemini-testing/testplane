"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(require("events"));
const logger_1 = __importDefault(require("./logger"));
class PageLoader extends events_1.default {
    constructor(session, { selectors, predicate, timeout, waitNetworkIdle, waitNetworkIdleTimeout }) {
        super();
        this.totalRequests = 0;
        this.networkResolved = false;
        this.session = session;
        this.selectors = selectors;
        this.predicate = predicate;
        this.timeout = timeout;
        this.waitNetworkIdle = waitNetworkIdle;
        this.waitNetworkIdleTimeout = waitNetworkIdleTimeout;
    }
    async load(goToPage) {
        await this.initMock();
        await goToPage().catch(err => {
            this.emit("pageLoadError", err);
        });
        this.startAwaitingSelectorsWithTimeout();
        this.startAwaitingPredicateWithTimeout();
        this.startAwaitingNetworkIdleWithTimeout();
    }
    unsubscribe() {
        return this.mock?.restore().catch(() => {
            logger_1.default.warn("PageLoader: Got error while unsubscribing");
        });
    }
    startAwaitingSelectorsWithTimeout() {
        const selectorPromises = this.selectors.map(async (selector) => {
            const element = await this.session.$(selector);
            await element.waitForExist({ timeout: this.timeout });
        });
        Promise.all(selectorPromises)
            .then(() => {
            this.emit("selectorsExist");
        })
            .catch(err => {
            this.emit("selectorsError", err);
        });
    }
    startAwaitingPredicateWithTimeout() {
        if (!this.predicate) {
            return;
        }
        this.session
            .waitUntil(this.predicate, { timeout: this.timeout })
            .then(() => {
            this.emit("predicateResolved");
        })
            .catch(() => {
            this.emit("predicateError", new Error(`predicate was never truthy in ${this.timeout}ms`));
        });
    }
    startAwaitingNetworkIdleWithTimeout() {
        if (!this.waitNetworkIdle) {
            return;
        }
        setTimeout(() => {
            const markSuccess = this.markNetworkIdle();
            if (markSuccess) {
                logger_1.default.warn(`PageLoader: Network idle timeout`);
            }
        }, this.timeout);
        setTimeout(() => {
            if (!this.totalRequests) {
                this.markNetworkIdle();
            }
        }, this.waitNetworkIdleTimeout);
    }
    async initMock() {
        if (!this.waitNetworkIdle) {
            return;
        }
        this.mock = await this.session.mock("**").catch(() => {
            logger_1.default.warn(`PageLoader: Could not create CDP interceptor`);
            return null;
        });
        if (!this.mock) {
            this.markNetworkIdle();
            return;
        }
        let pendingRequests = 0;
        let pendingIdleTimeout;
        this.mock.on("request", () => {
            this.totalRequests++;
            pendingRequests++;
            clearTimeout(pendingIdleTimeout);
        });
        this.mock.on("continue", () => {
            pendingRequests--;
            if (!pendingRequests) {
                pendingIdleTimeout = setTimeout(() => this.markNetworkIdle(), this.waitNetworkIdleTimeout);
            }
        });
        this.mock.on("match", (match) => {
            if (this.isMatchError(match)) {
                this.emit("networkError", match);
            }
        });
    }
    isMatchError(match) {
        return match.statusCode >= 400 && match.statusCode < 600;
    }
    markNetworkIdle() {
        if (this.networkResolved) {
            return false;
        }
        this.networkResolved = true;
        this.emit("networkResolved");
        return true;
    }
}
exports.default = PageLoader;
//# sourceMappingURL=page-loader.js.map